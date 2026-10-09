import { useMeshLocation } from '@uniformdev/mesh-sdk-react';
import type { NextPage } from 'next';

import type { ToolkitSettings } from '../components/content-ops-toolkit';
import { SettingsForm } from '../components/settings-form';
import { PageShell } from '../components/ui';

/**
 * Settings location: shown when the integration is opened from the project's
 * integration settings. The toolkit itself lives in the project tool location
 * (/content-ops).
 */
const SettingsPage: NextPage = () => {
  const { value, setValue, isReadOnly } = useMeshLocation<'settings', ToolkitSettings>('settings');

  return (
    <PageShell>
      <SettingsForm
        value={value}
        isReadOnly={isReadOnly}
        onSave={(next) => setValue(() => ({ newValue: next }))}
      />
    </PageShell>
  );
};

export default SettingsPage;
