/** @jsxImportSource @emotion/react */

import { css } from '@emotion/react';
import { mq } from '@uniformdev/design-system';
import type { ReactNode } from 'react';

/**
 * Layout primitives built only from Uniform design tokens and the system's
 * own responsiveness helper `mq(size)`. No hardcoded colors, spacing, or
 * ad-hoc media queries.
 */

const shell = css`
  width: 100%;
  max-width: 1140px;
  margin: 0 auto;
  padding-inline: var(--spacing-md);

  ${mq('md')} {
    padding-inline: var(--spacing-lg);
  }
`;

export function PageShell({ children }: { children: ReactNode }) {
  return <div css={shell}>{children}</div>;
}

export function Stack({
  gap = 'var(--spacing-md)',
  children,
}: {
  gap?: string;
  children: ReactNode;
}) {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: ${gap};
      `}
    >
      {children}
    </div>
  );
}
