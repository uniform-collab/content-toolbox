/** @jsxImportSource @emotion/react */

import { css } from '@emotion/react';
import { useQuery } from '@tanstack/react-query';
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@uniformdev/mesh-sdk-react';
import {
  Banner,
  Button,
  Callout,
  Caption,
  Chip,
  Icon,
  InputKeywordSearch,
  Link,
  ResponsiveTableContainer,
  Table,
  TableBody,
  TableCellData,
  TableCellHead,
  TableHead,
  TableRow,
  toast,
} from '@uniformdev/design-system';
import { useMemo, useState } from 'react';

import { headerIndex, parseBoolean, parseCsv, toCsv } from '../lib/csv';
import {
  clampOffset,
  CsvDropzone,
  downloadCsv,
  ImportDone,
  ImportPreview,
  LoadingRow,
  PaginationFooter,
  PanelSection,
  SectionHeader,
  type ImportPreviewRow,
} from './tool-shared';
import { Stack } from './ui';

interface Redirect {
  id?: string;
  sourceUrl: string;
  targetUrl: string;
  targetStatusCode: number;
  sourceRetainQuerystring?: boolean;
  sourceMustMatchDomain?: boolean;
  targetPreserveIncomingProtocol?: boolean;
  targetPreserveIncomingDomain?: boolean;
  targetMergeQuerystring?: boolean;
}

interface ImportRedirectRow extends Partial<Redirect> {
  issues: string[];
  warnings: string[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'same-origin' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as { redirects: Redirect[] };
};

export function useRedirectsQuery(projectId: string) {
  return useQuery<{ redirects: Redirect[] }, Error>({
    queryKey: ['redirects', projectId],
    queryFn: () => fetcher(`/api/uniform/redirects?projectId=${encodeURIComponent(projectId)}`),
    refetchOnWindowFocus: false,
    retry: false,
  });
}

const HEADERS = [
  'ID',
  'Source URL',
  'Target URL',
  'Status Code',
  'Retain Query String',
  'Must Match Domain',
  'Preserve Incoming Protocol',
  'Preserve Incoming Domain',
  'Merge Query String',
];

function parseRedirectsCsv(text: string): {
  rows: ImportRedirectRow[];
  error?: string;
} {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    return { rows: [], error: 'The CSV file has no data rows.' };
  }
  const headers = headerIndex(parsed[0]);
  const col = (key: string) => headers.get(key);

  const sourceCol = col('sourceurl') ?? col('source');
  const targetCol = col('targeturl') ?? col('target');
  const statusCol = col('statuscode') ?? col('targetstatuscode') ?? col('status');
  if (sourceCol === undefined || targetCol === undefined) {
    return {
      rows: [],
      error:
        'Could not find required columns. Expected headers: "Source URL", "Target URL", "Status Code" (matching the exported format).',
    };
  }

  const idCol = col('id');
  const retainCol = col('retainquerystring') ?? col('sourceretainquerystring');
  const domainCol = col('mustmatchdomain') ?? col('sourcemustmatchdomain');
  const protoCol = col('preserveincomingprotocol') ?? col('targetpreserveincomingprotocol');
  const presDomainCol = col('preserveincomingdomain') ?? col('targetpreserveincomingdomain');
  const mergeCol = col('mergequerystring') ?? col('targetmergequerystring');

  const rows: ImportRedirectRow[] = parsed.slice(1).map((cells) => {
    const get = (c: number | undefined) => (c !== undefined ? (cells[c] ?? '').trim() : '');
    const issues: string[] = [];
    const warnings: string[] = [];
    const sourceUrl = get(sourceCol);
    const targetUrl = get(targetCol);
    const statusRaw = get(statusCol);
    const targetStatusCode = statusRaw === '' ? 301 : Number.parseInt(statusRaw, 10);

    if (!sourceUrl) issues.push('Missing source URL');
    if (!targetUrl) issues.push('Missing target URL');
    if (Number.isNaN(targetStatusCode)) {
      issues.push(`Invalid status code "${statusRaw}" (use 301, 302, 307, or 308)`);
    } else if (![301, 302, 307, 308].includes(targetStatusCode)) {
      warnings.push(`Unusual status code ${targetStatusCode}`);
    }

    return {
      id: get(idCol) || undefined,
      sourceUrl,
      targetUrl,
      targetStatusCode: Number.isNaN(targetStatusCode) ? undefined : targetStatusCode,
      sourceRetainQuerystring: parseBoolean(get(retainCol) || undefined),
      sourceMustMatchDomain: parseBoolean(get(domainCol) || undefined),
      targetPreserveIncomingProtocol: parseBoolean(get(protoCol) || undefined),
      targetPreserveIncomingDomain: parseBoolean(get(presDomainCol) || undefined),
      targetMergeQuerystring: parseBoolean(get(mergeCol) || undefined),
      issues,
      warnings,
    };
  });

  return { rows };
}

const FLAG_LABELS: [keyof Redirect, string][] = [
  ['sourceRetainQuerystring', 'Retain query string'],
  ['sourceMustMatchDomain', 'Must match domain'],
  ['targetPreserveIncomingProtocol', 'Preserve incoming protocol'],
  ['targetPreserveIncomingDomain', 'Preserve incoming domain'],
  ['targetMergeQuerystring', 'Merge query string'],
];

/** Classify a CSV row against the live redirects and describe the change. */
function classifyRows(rows: ImportRedirectRow[], redirects: Redirect[]) {
  const byId = new Map(redirects.filter((r) => r.id).map((r) => [r.id as string, r]));

  const previewRows: ImportPreviewRow[] = [];
  const changedRows: ImportRedirectRow[] = [];

  rows.forEach((row, i) => {
    if (row.issues.length > 0) {
      previewRows.push({
        action: 'error',
        name: row.sourceUrl || `Row ${i + 2}`,
        detail: row.issues.join('; '),
      });
      return;
    }

    const existing = row.id ? byId.get(row.id) : undefined;
    const warn = row.warnings.length > 0 ? ` — ${row.warnings.join('; ')}` : '';

    if (!existing) {
      previewRows.push({
        action: 'create',
        name: row.sourceUrl ?? '',
        detail: `→ ${row.targetUrl} (${row.targetStatusCode})${warn}`,
      });
      changedRows.push(row);
      return;
    }

    const changes: string[] = [];
    if (row.sourceUrl !== existing.sourceUrl) {
      changes.push(`Source: ${existing.sourceUrl} → ${row.sourceUrl}`);
    }
    if (row.targetUrl !== existing.targetUrl) {
      changes.push(`Target: ${existing.targetUrl} → ${row.targetUrl}`);
    }
    if (row.targetStatusCode !== existing.targetStatusCode) {
      changes.push(`Status code: ${existing.targetStatusCode} → ${row.targetStatusCode}`);
    }
    for (const [key, label] of FLAG_LABELS) {
      const next = row[key] as boolean | undefined;
      if (next !== undefined && next !== ((existing[key] as boolean | undefined) ?? false)) {
        changes.push(`${label}: ${next ? 'on' : 'off'}`);
      }
    }

    if (changes.length === 0) return;
    previewRows.push({
      action: 'update',
      name: existing.sourceUrl,
      detail: changes.join('; ') + warn,
    });
    changedRows.push(row);
  });

  const unchanged = rows.filter((r) => r.issues.length === 0).length - changedRows.length;
  return { previewRows, changedRows, unchanged };
}

function codeLabel(code: number) {
  if (code === 301 || code === 308) return 'permanent';
  if (code === 302 || code === 307) return 'temporary';
  return '';
}

const PAGE_SIZE = 10;

export function RedirectsPanel({ projectId }: { projectId: string }) {
  const { data, error, isLoading, refetch } = useRedirectsQuery(projectId);

  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const [importStage, setImportStage] = useState<'idle' | 'preview' | 'done'>('idle');
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState<ImportRedirectRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [doneSummary, setDoneSummary] = useState('');
  const [doneErrorDetail, setDoneErrorDetail] = useState<string | undefined>(undefined);

  const redirects = useMemo(() => data?.redirects ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return redirects.filter(
      (r) => !q || r.sourceUrl.toLowerCase().includes(q) || r.targetUrl.toLowerCase().includes(q)
    );
  }, [redirects, search]);

  const safeOffset = clampOffset(offset, filtered.length, PAGE_SIZE);
  const pageRows = filtered.slice(safeOffset, safeOffset + PAGE_SIZE);

  const classified = useMemo(
    () => (data && importStage === 'preview' ? classifyRows(importRows, data.redirects) : null),
    [data, importStage, importRows]
  );

  const handleExport = () => {
    if (redirects.length === 0) return;
    const rows = redirects.map((r) => [
      r.id ?? '',
      r.sourceUrl,
      r.targetUrl,
      r.targetStatusCode,
      r.sourceRetainQuerystring ?? '',
      r.sourceMustMatchDomain ?? '',
      r.targetPreserveIncomingProtocol ?? '',
      r.targetPreserveIncomingDomain ?? '',
      r.targetMergeQuerystring ?? '',
    ]);
    downloadCsv(`redirects-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([HEADERS, ...rows]));
    toast.success(`Exported ${redirects.length} redirects to CSV.`);
  };

  const handleTemplate = (e: React.MouseEvent) => {
    e.preventDefault();
    downloadCsv(
      'redirects-template.csv',
      toCsv([
        ['ID', 'Source URL', 'Target URL', 'Status Code', 'Retain Query String'],
        ['', '/old-path', '/en/new-path', '301', 'true'],
      ])
    );
    toast.success('Template downloaded.');
  };

  const handleFile = (name: string, text: string) => {
    const { rows, error: parseError } = parseRedirectsCsv(text);
    if (parseError) {
      setImportError(parseError);
      return;
    }
    setImportError(null);
    setImportRows(rows);
    setImportFileName(name);
    setImportStage('preview');
  };

  const resetImport = () => {
    setImportStage('idle');
    setImportRows([]);
    setImportError(null);
  };

  const handleApply = async () => {
    if (!classified || classified.changedRows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/uniform/redirects', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
        },
        body: JSON.stringify({
          projectId,
          redirects: classified.changedRows.map(
            ({ issues: _issues, warnings: _warnings, ...redirect }) => redirect
          ),
        }),
      });
      const result = (await res.json()) as {
        succeeded: number;
        errors: { sourceUrl: string; message: string }[];
        error?: string;
      };
      if (!res.ok) throw new Error(result.error ?? `Import failed (${res.status})`);

      const updates = classified.previewRows.filter((r) => r.action === 'update').length;
      const creates = classified.previewRows.filter((r) => r.action === 'create').length;
      const skipped = classified.previewRows.filter((r) => r.action === 'error').length;
      setDoneSummary(
        `${result.succeeded} of ${updates + creates} changes written (${updates} updates, ${creates} new)` +
          (skipped ? `, ${skipped} rows skipped due to errors.` : '.')
      );
      setDoneErrorDetail(
        result.errors.length > 0
          ? `${result.errors.length} failed — first error: ${result.errors[0].sourceUrl}: ${result.errors[0].message}`
          : undefined
      );
      setImportStage('done');
      if (result.errors.length === 0) {
        toast.success(`Imported ${result.succeeded} redirects into Uniform.`);
      } else {
        toast.warning(`Imported ${result.succeeded} redirects; ${result.errors.length} failed.`);
      }
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  if (error) {
    return <Banner type="danger">Could not load redirects: {error.message}</Banner>;
  }

  return (
    <Stack gap="var(--spacing-lg)">
      {/* ------- Export ------- */}
      <PanelSection label="Export redirects">
        <SectionHeader
          title="Export redirects to CSV"
          description="Columns: ID, Source URL, Target URL, Status Code, and the boolean redirect flags."
          actions={
            <>
              <Button
                buttonType="primary"
                disabled={!data || redirects.length === 0}
                onClick={handleExport}
              >
                <Icon icon="software-download" size="1rem" iconColor="currentColor" />
                Download CSV
              </Button>
              {data && redirects.length > 0 ? (
                <Caption>
                  {HEADERS.length} columns × {redirects.length} rows
                </Caption>
              ) : null}
            </>
          }
        />

        {isLoading ? <LoadingRow label="Loading redirects…" /> : null}

        {data && redirects.length > 0 ? (
          <Stack gap="var(--spacing-sm)">
            <div
              css={css`
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: var(--spacing-sm);
              `}
            >
              <div
                css={css`
                  flex: 1 1 240px;
                `}
              >
                <InputKeywordSearch
                  aria-label="Filter redirects"
                  placeholder="Filter redirects by source or target URL…"
                  value={search}
                  onSearchTextChanged={(v) => {
                    setSearch(v);
                    setOffset(0);
                  }}
                  onClear={() => {
                    setSearch('');
                    setOffset(0);
                  }}
                  disabledFieldSubmission
                />
              </div>
              <Caption>
                {filtered.length} of {redirects.length} redirects
              </Caption>
            </div>

            <ResponsiveTableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCellHead>Source</TableCellHead>
                    <TableCellHead>Target</TableCellHead>
                    <TableCellHead>Code</TableCellHead>
                    <TableCellHead>Query string</TableCellHead>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageRows.map((r, i) => (
                    <TableRow key={r.id ?? `${r.sourceUrl}-${i}`}>
                      <TableCellData>
                        <code
                          css={css`
                            font-size: var(--fs-sm);
                          `}
                        >
                          {r.sourceUrl}
                        </code>
                      </TableCellData>
                      <TableCellData>
                        <code
                          css={css`
                            font-size: var(--fs-sm);
                          `}
                        >
                          {r.targetUrl}
                        </code>
                      </TableCellData>
                      <TableCellData>
                        <Chip
                          theme={
                            r.targetStatusCode === 301 || r.targetStatusCode === 308
                              ? 'utility-success'
                              : 'utility-info'
                          }
                          text={`${r.targetStatusCode} ${codeLabel(r.targetStatusCode)}`.trim()}
                        />
                      </TableCellData>
                      <TableCellData>
                        <span
                          css={css`
                            color: ${r.sourceRetainQuerystring
                              ? 'var(--typography-base)'
                              : 'var(--typography-light)'};
                          `}
                        >
                          {r.sourceRetainQuerystring ? 'Preserved' : '—'}
                        </span>
                      </TableCellData>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length === 0 ? (
                <p
                  css={css`
                    margin: 0;
                    padding: var(--spacing-lg);
                    text-align: center;
                    font-size: var(--fs-sm);
                    color: var(--typography-light);
                  `}
                >
                  No redirects match "{search}".
                </p>
              ) : null}
              <PaginationFooter
                total={filtered.length}
                pageSize={PAGE_SIZE}
                offset={safeOffset}
                onOffsetChange={setOffset}
              />
            </ResponsiveTableContainer>
          </Stack>
        ) : null}

        {data && redirects.length === 0 ? (
          <Callout type="info" title="No redirects in this project yet" compact>
            Create redirects in bulk by importing a CSV below. Required columns: Source URL, Target
            URL, Status Code. <Link text="Download a template CSV" href="#" onClick={handleTemplate} />
          </Callout>
        ) : null}
      </PanelSection>

      {/* ------- Import ------- */}
      <PanelSection label="Import redirects">
        <SectionHeader
          title="Import redirects from CSV"
          description={
            <>
              Rows with an ID update existing redirects; rows without an ID create new ones. You
              will review every change before anything is written.{' '}
              <Link text="Download a template CSV" href="#" onClick={handleTemplate} />
            </>
          }
        />

        {importError ? <Banner type="danger">{importError}</Banner> : null}

        {importStage === 'idle' ? <CsvDropzone disabled={!data} onFile={handleFile} /> : null}

        {importStage === 'preview' && classified ? (
          <ImportPreview
            fileName={importFileName}
            rows={classified.previewRows}
            unchangedCount={classified.unchanged}
            monoNames
            applying={importing}
            onCancel={resetImport}
            onApply={handleApply}
          />
        ) : null}

        {importStage === 'done' ? (
          <ImportDone summary={doneSummary} errorDetail={doneErrorDetail} onReset={resetImport} />
        ) : null}
      </PanelSection>
    </Stack>
  );
}
