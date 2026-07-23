/** @jsxImportSource @emotion/react */

import { css } from '@emotion/react';
import {
  Heading,
  TabButton,
  TabButtonGroup,
  TabContent,
  Tabs,
  ToastContainer,
} from '@uniformdev/design-system';
import { useState } from 'react';

import { ProjectMapPanel } from './project-map-panel';
import { RedirectsPanel } from './redirects-panel';

export function ContentOpsToolkit({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<string | undefined>('project-map');

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
          Export and import your Uniform project map and redirects as CSV.
        </p>
      </div>

      <Tabs selectedId={tab} onSelectedIdChange={setTab}>
        <TabButtonGroup aria-label="Toolkit sections">
          <TabButton id="project-map">Project map</TabButton>
          <TabButton id="redirects">Redirects</TabButton>
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
