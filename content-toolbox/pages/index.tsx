import {
  Button,
  Callout,
  Heading,
  Paragraph,
  Switch,
  toast,
  ToastContainer,
  VerticalRhythm,
} from '@uniformdev/design-system';
import { useMeshLocation } from '@uniformdev/mesh-sdk-react';
import type { NextPage } from 'next';
import { useState } from 'react';

import type { ToolkitSettings } from '../components/content-ops-toolkit';
import { PageShell } from '../components/ui';

/**
 * Settings location: shown when the integration is opened from the project's
 * integration settings. Admins use it to turn CSV import on or off. The
 * toolkit itself lives in the project tool location (/content-ops).
 *
 * The API routes also read these settings, so a turned-off import is refused
 * on the server too, not only hidden in the UI.
 */
const SettingsPage: NextPage = () => {
  const { value, setValue, isReadOnly } = useMeshLocation<'settings', ToolkitSettings>('settings');
  const saved = value ?? {};

  const [allowProjectMapImport, setAllowProjectMapImport] = useState(
    saved.allowProjectMapImport !== false
  );
  const [allowRedirectsImport, setAllowRedirectsImport] = useState(
    saved.allowRedirectsImport !== false
  );
  const [saving, setSaving] = useState(false);

  const dirty =
    allowProjectMapImport !== (saved.allowProjectMapImport !== false) ||
    allowRedirectsImport !== (saved.allowRedirectsImport !== false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setValue((previous) => ({
        newValue: { ...previous, allowProjectMapImport, allowRedirectsImport },
      }));
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <ToastContainer />
      <VerticalRhythm gap="md">
        <Heading level={4}>Content Toolbox</Heading>
        <Paragraph>
          Bulk content operations for this project: export and import project map nodes and redirects
          as CSV. Open it from the <strong>Tools</strong> section of your project as{' '}
          <strong>Content Ops Toolkit</strong>.
        </Paragraph>

        <Heading level={5}>CSV import</Heading>
        <Paragraph>
          Export is always available. Turn off an import to make that part of the toolkit read-only
          for everyone in this project.
        </Paragraph>
        <Switch
          label="Allow project map import from CSV"
          checked={allowProjectMapImport}
          disabled={isReadOnly || saving}
          onChange={(e) => setAllowProjectMapImport(e.target.checked)}
        />
        <Switch
          label="Allow redirects import from CSV"
          checked={allowRedirectsImport}
          disabled={isReadOnly || saving}
          onChange={(e) => setAllowRedirectsImport(e.target.checked)}
        />
        <div>
          <Button
            buttonType="primary"
            disabled={isReadOnly || !dirty || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {isReadOnly ? (
          <Callout type="info" compact>
            You do not have permission to change these settings.
          </Callout>
        ) : null}

        <Callout type="info" title="Requirements" compact>
          Identity delegation must be enabled for this integration so all reads and writes run as the
          signed-in user with their permissions.
        </Callout>
      </VerticalRhythm>
    </PageShell>
  );
};

export default SettingsPage;
