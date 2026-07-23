# Locations

Locations define the areas of the Uniform dashboard that a Mesh integration can extend by rendering custom UI in an iframe. Each location is defined in the integration manifest and served by a URL.

For how locations receive data (value/metadata) and iframe routing, see [architecture.md](architecture.md).

## Location overview

| Location | Category | Use when |
|---|---|---|
| [Install](#install-location) | Basic | Showing a description and docs link on the installation dialog |
| [Settings](#settings-location) | Basic | Configuring integration-wide settings after installation |
| [Data Source](#data-source-editor) | Data Connectors | Configuring API connections and managing authentication credentials securely |
| [Data Type](#data-type-editor) | Data Connectors | Defining API endpoints, query parameters, and request structure |
| [Data Resource](#data-resource-editor) | Data Connectors | Letting authors select or query data from external systems |
| [Parameter Type](#parameter-type-editor) | Canvas | Creating custom input controls for component parameters or entry fields |
| [Parameter Type Configuration](#parameter-type-configuration) | Canvas | Providing configuration UI for custom parameter types in component definitions |
| [Editor tools](#editor-tools) | Canvas | Extending the visual editor side rail with custom tools |
| [Personalization selection algorithms](#personalization-selection-algorithms) | Canvas | Registering custom algorithms for selecting personalization variations |
| [Asset Library](#asset-library) | Assets | Browsing and managing assets from external DAM systems |
| [Asset Parameter](#asset-parameter) | Assets | Custom asset selection interface inside the asset picker modal |
| [Project Tools](#project-tools) | Project | Embedding full custom pages in the Tools section |
| [Dashboard tools](#dashboard-tools) | Project | Adding custom tabs to the project dashboard |

---

## Install location

Shown in a drawer when a user is about to install the integration. Unlike other locations, the Install location is **not** rendered in an iframe — it is defined entirely in the manifest.

```json
{
  "locations": {
    "install": {
      "description": [
        "First paragraph describing the integration.",
        "Each array element creates a new paragraph."
      ],
      "informationUrl": "https://yoursite.com/docs"
    }
  }
}
```

## Settings location

Shown after the integration is installed or when editing integration settings. Used for integration-wide configuration accessible from Project Settings > Integrations.

**Manifest:**

```json
{
  "locations": {
    "settings": {
      "url": "/settings"
    }
  }
}
```

**Implementation:**

```tsx
import { useMeshLocation } from '@uniformdev/mesh-sdk-react';
import { Input, Button } from '@uniformdev/design-system';

const Settings = () => {
  const { value, setValue } = useMeshLocation<'settings', { apiKey: string }>('settings');
  const [apiKey, setApiKey] = useState(value?.apiKey ?? '');

  const handleSave = () => {
    setValue((previous) => ({ newValue: { ...previous, apiKey } }));
  };

  return (
    <div>
      <Input label="API Key" value={apiKey} onChange={(e) => setApiKey(e.currentTarget.value)} />
      <Button onClick={handleSave}>Save Settings</Button>
    </div>
  );
};
```

**Security note**: Do not save access credentials in Settings if using data connectors for edge-based data fetching. Use the [Data Source location](#data-source-editor) instead, which has encrypted secret storage.

## Data connector locations

> **Default HTTP UI fallback**: For data source, data type, and data resource locations, Uniform provides a default HTTP configuration UI as a fallback. This means you only need to implement custom location UIs for the parts that require specialized behavior — any location you omit will use the built-in HTTP editor automatically.

## Data source editor

Configures connection settings for the external system. Rendered when creating or editing a data source.

**Manifest** (configured as part of the data connector):

```json
{
  "dataConnectors": [
    {
      "dataSourceEditorUrl": "/data-source"
    }
  ]
}
```

**Implementation:**

```tsx
import { useMeshLocation, DataSourceLocationValue } from '@uniformdev/mesh-sdk-react';

type DataSourceConfig = { apiUrl: string; apiKey: string };

const DataSourceEditor = () => {
  const { value, setValue } = useMeshLocation<'dataSource'>();
  const config = value.custom as DataSourceConfig;

  const handleUpdate = (updates: Partial<DataSourceConfig>) => {
    setValue((current) => {
      const newConfig = { ...config, ...updates };
      const newValue: DataSourceLocationValue = {
        ...current,
        baseUrl: newConfig.apiUrl,
        headers: [{ key: 'Authorization', value: `Bearer ${newConfig.apiKey}` }],
        custom: newConfig,
        variants: {
          preview: { baseUrl: newConfig.apiUrl, parameters: [{ key: 'preview', value: 'true' }] }
        }
      };
      return { newValue, options: { isValid: true } };
    });
  };

  return (
    <div>
      <Input label="API URL" value={config?.apiUrl || ''} onChange={(e) => handleUpdate({ apiUrl: e.currentTarget.value })} />
      <Input label="API Key" value={config?.apiKey || ''} onChange={(e) => handleUpdate({ apiKey: e.currentTarget.value })} />
    </div>
  );
};
```

**Secrets**: Query string/header values and variable values on data sources are encrypted. Only users with manage data source or admin permissions can decrypt. All others use them via delegation without seeing the secret values.

## Data type editor

Configures how data is retrieved — the endpoint, query parameters, and request structure. Rendered when creating or editing a data type belonging to the integration's data connector.

Metadata includes the project ID and a copy of the parent data source.

**Manifest** (configured within a data archetype):

```json
{
  "dataArchetypes": {
    "type-id": {
      "displayName": "Type name",
      "typeEditorUrl": "/data-type"
    }
  }
}
```

**Implementation:**

```tsx
import { useMeshLocation, DataTypeLocationValue } from '@uniformdev/mesh-sdk-react';

const DataTypeEditor = () => {
  const { setValue, value } = useMeshLocation('dataType');
  const [selectedFields, setSelectedFields] = useState([]);

  useEffect(() => {
    setValue((prev: DataTypeLocationValue) => ({
      newValue: {
        ...prev,
        path: '/api/items/${itemId}',
        parameters: [{ key: 'fields', value: selectedFields.join(','), omitIfEmpty: true }],
        custom: { fields: selectedFields }
      }
    }));
  }, [selectedFields]);

  return (
    <ScrollableList label="Fields to include">
      {AVAILABLE_FIELDS.map(field => (
        <ScrollableListItem key={field} buttonText={field} active={selectedFields.includes(field)} onClick={() => toggleField(field)} />
      ))}
    </ScrollableList>
  );
};
```

**Security note**: Data types are not for secret values. Values stored in data types are viewable by any project user. Use Data Sources for authentication tokens.

## Data resource editor

Enables authors to select or query specific data items. This location typically has the greatest impact on the authoring experience. Rendered when creating or editing a data resource in a composition, component pattern, entry, or entry pattern.

**Manifest** (configured within a data archetype):

```json
{
  "dataArchetypes": {
    "type-id": {
      "displayName": "Archetype name",
      "dataEditorUrl": "/data-resource"
    }
  }
}
```

**Typical features**: deep links to edit data in the external system, paging/sorting, search/filter, query builders, item pickers.

**Implementation:**

```tsx
import { useMeshLocation, ObjectSearchProvider, ObjectSearchContainer, ObjectSearchListItem } from '@uniformdev/mesh-sdk-react';

const DataResourceEditor = () => {
  const { setValue, getDataResource } = useMeshLocation<'dataResource'>();
  const [items, setItems] = useState([]);

  const fetchItems = async (query?: string) => {
    const path = query ? `/api/items?search=${query}` : '/api/items';
    const data = await getDataResource({ path });
    setItems(data);
  };

  const handleSelection = (selectedItem: any) => {
    setValue(() => ({ newValue: { itemId: selectedItem.id } }));
  };

  return (
    <ObjectSearchProvider>
      <ObjectSearchContainer
        label="Select Item"
        searchFilters={<InputKeywordSearch onSearchTextChanged={fetchItems} />}
        resultList={items.map(item => (
          <ObjectSearchListItem key={item.id} id={item.id} title={item.title} onClick={() => handleSelection(item)} />
        ))}
      />
    </ObjectSearchProvider>
  );
};
```

## Parameter type editor

Custom input controls for component parameters or entry fields. Rendered in the property panel when a component uses a parameter type defined in the integration manifest.

**Manifest:**

```json
{
  "locations": {
    "canvas": {
      "parameterTypes": [
        {
          "type": "parameter-type-id",
          "editorUrl": "/parameter-type",
          "displayName": "Parameter type name",
          "configureUrl": "/parameter-type-config",
          "renderableInPropertyPanel": true,
          "allowedPlacement": ["parameter"]
        }
      ]
    }
  }
}
```

**Enabling for content type fields**: By default, custom parameter types are only available for component parameters. To also enable them for content type fields, set:

```json
"allowedPlacement": ["parameter", "field"]
```

**Implementation:**

```tsx
import { useMeshLocation } from '@uniformdev/mesh-sdk-react';

const ParameterEditor = () => {
  const { value, setValue, metadata, isReadOnly } = useMeshLocation<'paramType', string>('paramType');

  return (
    <Input
      label={metadata.parameterDefinition.name}
      value={value ?? ''}
      onChange={(e) => setValue(() => ({ newValue: e.target.value }))}
      disabled={isReadOnly}
    />
  );
};
```

## Parameter type configuration

Configuration UI for a custom parameter type inside component definitions. Rendered when creating or editing a parameter that uses the custom type. This is the `configureUrl` counterpart to the parameter type `editorUrl`.

**Manifest** (defined as part of the parameter type — see `configureUrl` above):

```json
{
  "parameterTypes": [
    {
      "type": "parameter-type-id",
      "configureUrl": "/parameter-type-config"
    }
  ]
}
```

## Editor tools

Extends the visual editor with custom tools in the left side rail. Each tool is an array entry with an `id`, `name`, `url`, and an `editorTypes` array that controls which editor contexts the tool appears in (`composition`, `componentPattern`, `entry`, `entryPattern`).

**Manifest:**

```json
{
  "locations": {
    "canvas": {
      "editorTools": [
        {
          "id": "composition-editor-tool",
          "name": "Composition Editor Tool",
          "url": "/editor-tool",
          "editorTypes": ["composition"]
        },
        {
          "id": "component-pattern-editor-tool",
          "name": "Component Pattern Editor Tool",
          "url": "/editor-tool",
          "editorTypes": ["componentPattern"]
        },
        {
          "id": "entry-editor-tool",
          "name": "Entry Editor Tool",
          "url": "/editor-tool",
          "editorTypes": ["entry"]
        },
        {
          "id": "entry-pattern-editor-tool",
          "name": "Entry Pattern Editor Tool",
          "url": "/editor-tool",
          "editorTypes": ["entryPattern"]
        }
      ]
    }
  }
}
```

## Personalization selection algorithms

Registers custom algorithms for selecting personalization variations. Rendered in the Context tab of the property panel of a personalization component when a custom matching method is configured.

**Manifest:**

```json
{
  "locations": {
    "canvas": {
      "personalization": {
        "selectionAlgorithms": {
          "custom-algorithm-id": {
            "displayName": "Custom algorithm",
            "description": "Description of the custom algorithm",
            "criteriaEditorUrl": "/personalization-criteria-editor"
          }
        }
      }
    }
  }
}
```

## Asset library

Browse and manage assets from an external DAM system. Rendered in the Experience > Assets section of the Uniform project.

**Manifest:**

```json
{
  "locations": {
    "assetLibrary": {
      "assetLibraryUrl": "/asset-library",
      "assetParameterUrl": "/asset-parameter"
    }
  }
}
```

## Asset parameter

Custom interface for selecting assets inside the asset picker modal when authors are picking assets for component parameters or entry fields. Configured as part of the asset library (see `assetParameterUrl` above).

## Project tools

Embeds full custom pages accessible from the Tools section in the main navigation. Common use cases: Storybook as a component reference, importers, editorial calendars, embedded analytics.

**Manifest:**

```json
{
  "locations": {
    "projectTools": [
      {
        "id": "example-tool",
        "name": "Example Project Tool",
        "url": "/project-tool",
        "iconUrl": "/tool-icon.png"
      }
    ]
  }
}
```

## Dashboard tools

Adds custom tabs to the project dashboard. Common use cases: status/health dashboards, onboarding resources, editorial dashboards, quick links to common content.

**Manifest:**

```json
{
  "locations": {
    "dashboardTools": [
      {
        "id": "custom-dashboard-id",
        "name": "Custom dashboard",
        "url": "/dashboard-tool",
        "iconUrl": "/dashboard-icon.png"
      }
    ]
  }
}
```

---

## Common patterns

### Validation

```tsx
import { ValidationResult } from '@uniformdev/mesh-sdk-react';

const useValidation = (value: string): ValidationResult => {
  return useMemo(() => {
    if (!value || value.trim().length === 0) {
      return { isValid: false, validationMessage: 'Value is required' };
    }
    try {
      new URL(value);
      return { isValid: true };
    } catch {
      return { isValid: false, validationMessage: 'Invalid URL format' };
    }
  }, [value]);
};
```

### Dialog management

```tsx
import { useOpenDialog, useCloseDialog } from '@uniformdev/mesh-sdk-react';

const ComponentWithDialog = () => {
  const openDialog = useOpenDialog();

  const handleOpenDialog = () => {
    openDialog({ location: 'namedDialog', size: 'medium', title: 'Custom Dialog' });
  };

  return <Button onClick={handleOpenDialog}>Open Dialog</Button>;
};
```

### Error handling

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { Callout } from '@uniformdev/design-system';

const ErrorFallback = ({ error }: { error: Error }) => (
  <Callout type="error" title="Integration Error">{error.message}</Callout>
);

const IntegrationComponent = () => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <YourComponent />
  </ErrorBoundary>
);
```

## Implementation guidance

IMPORTANT: Do not add anything extra to location implementations that the user didn't ask for. Only add essential code that supports requested functionality.
