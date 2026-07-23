import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMeshLocation } from '@uniformdev/mesh-sdk-react';
import type { NextPage } from 'next';

import { ContentOpsToolkit } from '../components/content-ops-toolkit';
import { PageShell } from '../components/ui';

const queryClient = new QueryClient();

/**
 * Project tool location: renders the Content Ops Toolkit in the Tools section
 * of the Uniform dashboard. The current project ID comes from the location
 * metadata, so the tool always operates on the project it is opened in.
 */
const ContentOpsToolPage: NextPage = () => {
  const { metadata } = useMeshLocation<'projectTool'>();

  return (
    <QueryClientProvider client={queryClient}>
      <PageShell>
        <ContentOpsToolkit projectId={metadata.projectId} />
      </PageShell>
    </QueryClientProvider>
  );
};

export default ContentOpsToolPage;
