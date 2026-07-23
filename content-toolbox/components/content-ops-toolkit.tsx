/** @jsxImportSource @emotion/react */

import { css } from '@emotion/react';
import {
  Counter,
  Heading,
  TabButton,
  TabButtonGroup,
  TabContent,
  Tabs,
  ToastContainer,
} from '@uniformdev/design-system';
import { useState } from 'react';

import { ProjectMapPanel, useProjectMapQuery } from './project-map-panel';
import { RedirectsPanel, useRedirectsQuery } from './redirects-panel';

export function ContentOpsToolkit({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<string | undefined>('project-map');

  // Same query keys as the panels, so react-query shares a single fetch.
  const { data: mapData } = useProjectMapQuery(projectId);
  const { data: redirData } = useRedirectsQuery(projectId);

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);
        padding-block: var(--spacing-md) var(--spacing-2xl);
      `}
    >
      <ToastContainer />

      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3xs);
        `}
      >
        <Heading level={3} withMarginBottom={false}>
          Content Ops Toolkit
        </Heading>
        <p
          css={css`
            margin: 0;
            font-size: var(--fs-sm);
            color: var(--typography-light);
            text-wrap: pretty;
          `}
        >
          Move your project map and redirects between Uniform and CSV.
        </p>
      </div>

      <Tabs selectedId={tab} onSelectedIdChange={setTab}>
        <TabButtonGroup aria-label="Toolkit sections">
          <TabButton id="project-map">
            <span
              css={css`
                display: inline-flex;
                align-items: center;
                gap: var(--spacing-2xs);
              `}
            >
              Project map
              <Counter count={mapData?.nodes.length} size="sm" bgColor="var(--gray-50)" />
            </span>
          </TabButton>
          <TabButton id="redirects">
            <span
              css={css`
                display: inline-flex;
                align-items: center;
                gap: var(--spacing-2xs);
              `}
            >
              Redirects
              <Counter count={redirData?.redirects.length} size="sm" bgColor="var(--gray-50)" />
            </span>
          </TabButton>
        </TabButtonGroup>
        <TabContent tabId="project-map" keepMounted>
          <div
            css={css`
              padding-top: var(--spacing-md);
            `}
          >
            <ProjectMapPanel projectId={projectId} />
          </div>
        </TabContent>
        <TabContent tabId="redirects" keepMounted>
          <div
            css={css`
              padding-top: var(--spacing-md);
            `}
          >
            <RedirectsPanel projectId={projectId} />
          </div>
        </TabContent>
      </Tabs>
    </div>
  );
}
