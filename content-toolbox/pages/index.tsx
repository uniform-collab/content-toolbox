import { Callout, Heading, Paragraph, VerticalRhythm } from '@uniformdev/design-system';
import type { NextPage } from 'next';

import { PageShell } from '../components/ui';

/**
 * Settings location: shown when the integration is opened from
 * Team → Settings → Integrations. The toolkit itself lives in the
 * project tool location (/content-ops).
 */
const SettingsPage: NextPage = () => (
  <PageShell>
    <VerticalRhythm gap="md">
      <Heading level={4}>Content Toolbox</Heading>
      <Paragraph>
        Bulk content operations for this project: export and import project map nodes and redirects
        as CSV. Open it from the <strong>Tools</strong> section of your project as{' '}
        <strong>Content Ops Toolkit</strong>.
      </Paragraph>
      <Callout type="info" title="Requirements" compact>
        Identity delegation must be enabled for this integration so all reads and writes run as the
        signed-in user with their permissions.
      </Callout>
    </VerticalRhythm>
  </PageShell>
);

export default SettingsPage;
