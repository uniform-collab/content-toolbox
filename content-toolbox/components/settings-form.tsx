/** @jsxImportSource @emotion/react */

import { css } from '@emotion/react';
import {
  Button,
  Callout,
  Caption,
  Fieldset,
  HorizontalRhythm,
  Legend,
  PageHeaderSection,
  Switch,
  toast,
  ToastContainer,
  VerticalRhythm,
} from '@uniformdev/design-system';
import { useEffect, useState } from 'react';

import type { ToolkitSettings } from './content-ops-toolkit';

/** Switch renders infoText as a <p>; drop the default paragraph margins so it sits under its label. */
const switchWithInfo = css`
  & > p {
    margin: var(--spacing-2xs) 0 0;
  }
`;

/**
 * Integration settings form. Admins use it to turn CSV import on or off.
 *
 * The settings location writes to the database on each save, so this is a
 * form with an explicit Save button. The API routes also read these
 * settings, so a turned-off import is refused on the server, not only hidden.
 */
export function SettingsForm({
  value,
  onSave,
  isReadOnly,
}: {
  value: ToolkitSettings | undefined;
  onSave: (next: ToolkitSettings) => Promise<void> | void;
  isReadOnly: boolean;
}) {
  const saved = value ?? {};
  const savedProjectMap = saved.allowProjectMapImport !== false;
  const savedRedirects = saved.allowRedirectsImport !== false;

  const [allowProjectMapImport, setAllowProjectMapImport] = useState(savedProjectMap);
  const [allowRedirectsImport, setAllowRedirectsImport] = useState(savedRedirects);
  const [saving, setSaving] = useState(false);

  // Follow the stored value if it arrives or changes after the first render.
  useEffect(() => setAllowProjectMapImport(savedProjectMap), [savedProjectMap]);
  useEffect(() => setAllowRedirectsImport(savedRedirects), [savedRedirects]);

  const dirty =
    allowProjectMapImport !== savedProjectMap || allowRedirectsImport !== savedRedirects;
  const disabled = isReadOnly || saving;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...saved, allowProjectMapImport, allowRedirectsImport });
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VerticalRhythm gap="lg">
      <ToastContainer />

      <PageHeaderSection
        title="Content Toolbox"
        desc="Export and import the project map and redirects as CSV. Open the toolkit from the Tools section of your project as Content Ops Toolkit."
      />

      <Callout type="info" title="Requirement" compact>
        Identity delegation must be enabled for this integration. All reads and writes run as the
        signed-in user, with that user&apos;s permissions.
      </Callout>

      {isReadOnly ? (
        <Callout type="caution" compact>
          You do not have permission to change these settings.
        </Callout>
      ) : null}

      <Fieldset legend={<Legend>CSV import</Legend>} disabled={disabled}>
        <VerticalRhythm gap="md">
          <Caption>
            Export is always available. When an import is off, its Import section is hidden for
            everyone in this project.
          </Caption>
          <div css={switchWithInfo}>
            <Switch
              label="Allow project map import"
              infoText="Editors can create and update project map nodes from a CSV file."
              checked={allowProjectMapImport}
              disabled={disabled}
              onChange={(e) => setAllowProjectMapImport(e.target.checked)}
            />
          </div>
          <div css={switchWithInfo}>
            <Switch
              label="Allow redirects import"
              infoText="Editors can create and update redirects from a CSV file."
              checked={allowRedirectsImport}
              disabled={disabled}
              onChange={(e) => setAllowRedirectsImport(e.target.checked)}
            />
          </div>
        </VerticalRhythm>
      </Fieldset>

      <HorizontalRhythm gap="sm" align="center">
        <Button buttonType="primary" disabled={disabled || !dirty} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {dirty && !saving ? <Caption>You have unsaved changes.</Caption> : null}
      </HorizontalRhythm>
    </VerticalRhythm>
  );
}
