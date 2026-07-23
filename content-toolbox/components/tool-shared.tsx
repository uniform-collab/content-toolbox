/** @jsxImportSource @emotion/react */

import { css } from '@emotion/react';
import {
  Banner,
  Button,
  Callout,
  Caption,
  Chip,
  DashedBox,
  LoadingIndicator,
  Pagination,
  Table,
  TableBody,
  TableCellData,
  TableRow,
} from '@uniformdev/design-system';
import { useRef, useState, type ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/* CSV download                                                        */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Section header: title + description left, actions right             */
/* ------------------------------------------------------------------ */

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      css={css`
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-sm) var(--spacing-lg);
      `}
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3xs);
          flex: 1 1 320px;
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
            flex-direction: column;
            align-items: flex-end;
            gap: var(--spacing-xs);
          `}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel section card                                                  */
/* ------------------------------------------------------------------ */

export function PanelSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);
        padding: var(--spacing-md);
        border: 1px solid var(--gray-200);
        border-radius: var(--rounded-lg);
        background: var(--white);
      `}
    >
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination footer (page-size wrapper around the DS component)       */
/* ------------------------------------------------------------------ */

export function PaginationFooter({
  total,
  pageSize,
  offset,
  onOffsetChange,
}: {
  total: number;
  pageSize: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) {
  if (total <= pageSize) return null;
  return (
    <div
      css={css`
        display: flex;
        justify-content: flex-end;
        padding-top: var(--spacing-xs);
      `}
    >
      <Pagination
        limit={pageSize}
        offset={offset}
        total={total}
        onPageChange={(_limit, newOffset) => onOffsetChange(newOffset)}
      />
    </div>
  );
}

/** Clamp an offset so it stays within a (possibly shrunken) filtered list. */
export function clampOffset(offset: number, total: number, pageSize: number) {
  if (total === 0) return 0;
  const lastPageOffset = Math.floor((total - 1) / pageSize) * pageSize;
  return Math.min(offset, lastPageOffset);
}

/* ------------------------------------------------------------------ */
/* CSV dropzone                                                        */
/* ------------------------------------------------------------------ */

export function CsvDropzone({
  disabled,
  onFile,
}: {
  disabled?: boolean;
  onFile: (name: string, text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const readFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    onFile(file.name, await file.text());
  };

  return (
    <DashedBox
      textAlign="center"
      boxHeight="sm"
      bgColor={dragOver ? 'var(--gray-50)' : 'white'}
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void readFile(e.dataTransfer.files?.[0]);
      }}
      css={css`
        cursor: ${disabled ? 'default' : 'pointer'};
      `}
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3xs);
          align-items: center;
        `}
      >
        <span
          css={css`
            font-size: var(--fs-base);
            font-weight: 600;
            color: var(--typography-base);
          `}
        >
          Drop a CSV here or click to browse
        </span>
        <Caption>Nothing is imported until you review and confirm the changes.</Caption>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        css={css`
          display: none;
        `}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          void readFile(e.target.files?.[0]);
          // Allow re-selecting the same file
          e.target.value = '';
        }}
      />
    </DashedBox>
  );
}

/* ------------------------------------------------------------------ */
/* Import preview                                                      */
/* ------------------------------------------------------------------ */

export type ImportAction = 'update' | 'create' | 'error';

export interface ImportPreviewRow {
  action: ImportAction;
  name: string;
  detail: string;
}

const ACTION_THEME: Record<ImportAction, 'utility-info' | 'utility-success' | 'utility-danger'> = {
  update: 'utility-info',
  create: 'utility-success',
  error: 'utility-danger',
};

export function ImportPreview({
  fileName,
  rows,
  unchangedCount,
  monoNames,
  applying,
  onCancel,
  onApply,
}: {
  fileName: string;
  rows: ImportPreviewRow[];
  unchangedCount?: number;
  /** Render the name column in monospace (used for redirect source URLs). */
  monoNames?: boolean;
  applying?: boolean;
  onCancel: () => void;
  onApply: () => void;
}) {
  const updates = rows.filter((r) => r.action === 'update').length;
  const creates = rows.filter((r) => r.action === 'create').length;
  const errors = rows.filter((r) => r.action === 'error').length;
  const changeCount = updates + creates;

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      `}
    >
      <div
        css={css`
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-sm);
        `}
      >
        <div
          css={css`
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--spacing-xs);
          `}
        >
          <code
            css={css`
              font-size: var(--fs-sm);
              color: var(--typography-light);
            `}
          >
            {fileName}
          </code>
          <Chip theme="utility-info" text={`${updates} updates`} />
          <Chip theme="utility-success" text={`${creates} new`} />
          {errors > 0 ? <Chip theme="utility-danger" text={`${errors} errors`} /> : null}
          {unchangedCount !== undefined && unchangedCount > 0 ? (
            <Chip theme="neutral-light" text={`${unchangedCount} unchanged`} />
          ) : null}
        </div>
        <div
          css={css`
            display: flex;
            gap: var(--spacing-sm);
          `}
        >
          <Button buttonType="ghost" disabled={applying} onClick={onCancel}>
            Cancel
          </Button>
          <Button buttonType="primary" disabled={applying || changeCount === 0} onClick={onApply}>
            {applying ? 'Applying…' : `Apply ${changeCount} changes`}
          </Button>
        </div>
      </div>

      {errors > 0 ? (
        <Banner type="caution">
          Rows with errors will be skipped. Fix them in the CSV and re-upload to include them.
        </Banner>
      ) : null}

      {changeCount === 0 && errors === 0 ? (
        <Callout type="info" compact>
          Every row in this file matches what is already in Uniform — there is nothing to apply.
        </Callout>
      ) : null}

      <div
        css={css`
          max-height: 480px;
          overflow-y: auto;
          border: 1px solid var(--gray-100);
          border-radius: var(--rounded-md);
        `}
      >
        <Table>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCellData
                  css={css`
                    width: 96px;
                  `}
                >
                  <Chip theme={ACTION_THEME[r.action]} text={r.action} />
                </TableCellData>
                <TableCellData>
                  {monoNames ? (
                    <code
                      css={css`
                        font-size: var(--fs-sm);
                      `}
                    >
                      {r.name}
                    </code>
                  ) : (
                    <span
                      css={css`
                        font-weight: 500;
                      `}
                    >
                      {r.name}
                    </span>
                  )}
                </TableCellData>
                <TableCellData>
                  <span
                    css={css`
                      color: var(--typography-light);
                    `}
                  >
                    {r.detail}
                  </span>
                </TableCellData>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Import done                                                         */
/* ------------------------------------------------------------------ */

export function ImportDone({
  summary,
  errorDetail,
  onReset,
}: {
  summary: string;
  errorDetail?: string;
  onReset: () => void;
}) {
  return (
    <Callout type={errorDetail ? 'caution' : 'success'} title="Import complete">
      <div
        css={css`
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-sm);
        `}
      >
        <span>{summary}</span>
        {errorDetail ? <span>{errorDetail}</span> : null}
        <Button buttonType="secondary" size="sm" onClick={onReset}>
          Import another file
        </Button>
      </div>
    </Callout>
  );
}

/* ------------------------------------------------------------------ */
/* Loading row                                                         */
/* ------------------------------------------------------------------ */

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
      <LoadingIndicator size="sm" aria-label={label} />
      <span
        aria-hidden="true"
        css={css`
          font-size: var(--fs-sm);
        `}
      >
        {label}
      </span>
    </div>
  );
}
