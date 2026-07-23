import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Callout, LoadingIndicator } from '@uniformdev/design-system';
import {
  DelegationGate,
  DelegationProvider,
  useMeshLocation,
  useUniformMeshSdk,
} from '@uniformdev/mesh-sdk-react';
import type { NextPage } from 'next';

import { ContentOpsToolkit } from '../components/content-ops-toolkit';
import { PageShell } from '../components/ui';
import { checkActive, onSessionToken } from '../lib/delegationSessionCallbacks';

const queryClient = new QueryClient();

function ToolkitBody() {
  const { metadata } = useMeshLocation<'projectTool'>();
  return <ContentOpsToolkit projectId={metadata.projectId} />;
}

/**
 * Project tool location: renders the Content Ops Toolkit in the Tools section
 * of the Uniform dashboard. All Uniform API calls run through identity
 * delegation — the BFF exchanges a dashboard session token for a delegation
 * access token scoped to the signed-in user, so reads and writes are
 * attributed to that user and respect their permissions.
 */
const ContentOpsToolPage: NextPage = () => {
  const sdk = useUniformMeshSdk();

  return (
    <QueryClientProvider client={queryClient}>
      <PageShell>
        <DelegationProvider sdk={sdk} checkActive={checkActive} onSessionToken={onSessionToken}>
          <DelegationGate
            loadingComponent={<LoadingIndicator aria-label="Connecting to Uniform…" />}
            disabledComponent={
              <Callout type="caution" title="Identity delegation is not enabled">
                Enable identity delegation for this integration in your team settings, then reload
                this page.
              </Callout>
            }
            errorComponent={({ error }) => (
              <Callout type="error" title="Could not establish a delegation session">
                {error.message}
              </Callout>
            )}
          >
            <ToolkitBody />
          </DelegationGate>
        </DelegationProvider>
      </PageShell>
    </QueryClientProvider>
  );
};

export default ContentOpsToolPage;
