/** @jsxImportSource @emotion/react */

import { css } from '@emotion/react';
import { Button, Icon, Spinner } from '@uniformdev/design-system';
import { useRef, type ReactNode } from 'react';

/** Trigger a client-side download of a CSV string. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A design-system button that opens a CSV file picker. */
export function CsvFilePicker({
  label,
  disabled,
  onFile,
}: {
  label: string;
  disabled?: boolean;
  onFile: (name: string, text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        css={css`
          display: none;
        `}
        aria-hidden="true"
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          onFile(file.name, text);
          // Allow re-selecting the same file
          e.target.value = '';
        }}
      />
      <Button buttonType="secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Icon icon="file-document" size="1rem" />
        {label}
      </Button>
    </>
  );
}

/** Inline loading row with the system spinner. */
export function LoadingRow({ label }: { label: string }) {
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        color: var(--typography-light);
        padding-block: var(--spacing-md);
      `}
    >
      <Spinner width={18} label={label} />
      <span
        css={css`
          font-size: var(--fs-sm);
        `}
      >
        {label}
      </span>
    </div>
  );
}

/** Section header inside a panel: title + optional actions on the right. */
export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      css={css`
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-sm);
      `}
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3xs);
        `}
      >
        <span
          css={css`
            font-size: var(--fs-base);
            font-weight: 600;
            color: var(--typography-base);
          `}
        >
          {title}
        </span>
        {description ? (
          <span
            css={css`
              font-size: var(--fs-sm);
              color: var(--typography-light);
              max-width: 62ch;
              text-wrap: pretty;
            `}
          >
            {description}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div
          css={css`
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--spacing-sm);
          `}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
