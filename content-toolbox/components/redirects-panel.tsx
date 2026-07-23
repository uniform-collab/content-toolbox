/** @jsxImportSource @emotion/react */

import { css } from '@emotion/react';
import { useQuery } from '@tanstack/react-query';
import {
  Banner,
  Button,
  Callout,
  Chip,
  Icon,
  ResponsiveTableContainer,
  Table,
  TableBody,
  TableCellData,
  TableCellHead,
  TableHead,
  TableRow,
  toast,
} from '@uniformdev/design-system';
import { useState } from 'react';

import { headerIndex, parseBoolean, parseCsv, toCsv } from '../lib/csv';
import { CsvFilePicker, downloadCsv, LoadingRow, PanelHeader } from './tool-shared';
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
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as { redirects: Redirect[] };
};

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
    const sourceUrl = get(sourceCol);
    const targetUrl = get(targetCol);
    const statusRaw = get(statusCol);
    const targetStatusCode = statusRaw === '' ? 301 : Number.parseInt(statusRaw, 10);

    if (!sourceUrl) issues.push('Missing source URL');
    if (!targetUrl) issues.push('Missing target URL');
    if (Number.isNaN(targetStatusCode)) {
      issues.push(`Invalid status code "${statusRaw}"`);
    } else if (![301, 302, 307, 308].includes(targetStatusCode)) {
      issues.push(`Unusual status code ${targetStatusCode}`);
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
    };
  });

  return { rows };
}

/** "Unusual status code" is a warning, not a blocker. */
function isBlocking(issue: string) {
  return !issue.startsWith('Unusual status code');
}

export function RedirectsPanel({ projectId }: { projectId: string }) {
  const { data, error, isLoading, refetch } = useQuery<{ redirects: Redirect[] }, Error>({
    queryKey: ['redirects', projectId],
    queryFn: () => fetcher(`/api/uniform/redirects?projectId=${encodeURIComponent(projectId)}`),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [importRows, setImportRows] = useState<ImportRedirectRow[] | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    succeeded: number;
    errors: { sourceUrl: string; message: string }[];
  } | null>(null);

  const handleExport = () => {
    if (!data) return;
    const rows = data.redirects.map((r) => [
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
    downloadCsv(
      `redirects-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([HEADERS, ...rows])
    );
    toast.success(`Exported ${data.redirects.length} redirects to CSV.`);
  };

  const handleFile = (name: string, text: string) => {
    setImportResult(null);
    const { rows, error: parseError } = parseRedirectsCsv(text);
    if (parseError) {
      setImportError(parseError);
      setImportRows(null);
      setImportFileName('');
      return;
    }
    setImportError(null);
    setImportRows(rows);
    setImportFileName(name);
  };

  const validRows = importRows?.filter((r) => r.issues.filter(isBlocking).length === 0) ?? [];
  const invalidRows = importRows?.filter((r) => r.issues.filter(isBlocking).length > 0) ?? [];

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/uniform/redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          redirects: validRows.map(({ issues: _issues, ...redirect }) => redirect),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? `Import failed (${res.status})`);
      setImportResult(result);
      if (result.errors.length === 0) {
        toast.success(`Imported ${result.succeeded} redirects into Uniform.`);
      } else {
        toast.warning(`Imported ${result.succeeded} redirects; ${result.errors.length} failed.`);
      }
      refetch();
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
      <section
        aria-label="Export redirects"
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
        <PanelHeader
          title="Export redirects to CSV"
          description={
            data
              ? `${data.redirects.length} redirects found in this project.`
              : 'Downloads all redirects with their source, target, status code, and flags.'
          }
          actions={
            <Button
              buttonType="primary"
              disabled={!data || data.redirects.length === 0}
              onClick={handleExport}
            >
              <Icon icon="software-download" size="1rem" />
              Download CSV
            </Button>
          }
        />

        {isLoading ? <LoadingRow label="Loading redirects…" /> : null}

        {data && data.redirects.length === 0 ? (
          <Callout type="info" title="No redirects yet" compact>
            This project has no redirects. Import a CSV below to create some — required columns:
            Source URL, Target URL, Status Code.
          </Callout>
        ) : null}

        {data && data.redirects.length > 0 ? (
          <ResponsiveTableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCellHead>Source URL</TableCellHead>
                  <TableCellHead>Target URL</TableCellHead>
                  <TableCellHead>Status</TableCellHead>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.redirects.slice(0, 30).map((r, i) => (
                  <TableRow key={r.id ?? i}>
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
                        theme={r.targetStatusCode === 301 ? 'utility-success' : 'utility-info'}
                        text={String(r.targetStatusCode)}
                      />
                    </TableCellData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.redirects.length > 30 ? (
              <p
                css={css`
                  margin: var(--spacing-xs) 0 0;
                  font-size: var(--fs-sm);
                  color: var(--typography-light);
                `}
              >
                Showing the first 30 of {data.redirects.length} redirects. The CSV export includes
                all of them.
              </p>
            ) : null}
          </ResponsiveTableContainer>
        ) : null}
      </section>

      {/* ------- Import ------- */}
      <section
        aria-label="Import redirects"
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
        <PanelHeader
          title="Import redirects from CSV"
          description="Upload a CSV with columns: ID (optional, for updates), Source URL, Target URL, Status Code, and optional boolean flags. Rows with an ID update existing redirects; rows without create new ones."
          actions={
            <CsvFilePicker label="Choose CSV file" disabled={importing} onFile={handleFile} />
          }
        />

        {importError ? <Banner type="danger">{importError}</Banner> : null}

        {importRows ? (
          <>
            <Callout type="caution" title="Review before importing" compact>
              {`"${importFileName}" contains ${importRows.length} rows: ${validRows.length} valid` +
                (invalidRows.length > 0
                  ? `, ${invalidRows.length} with issues (they will be skipped)`
                  : '') +
                '. Importing updates or creates redirects in Uniform.'}
            </Callout>

            <ResponsiveTableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCellHead>Source URL</TableCellHead>
                    <TableCellHead>Target URL</TableCellHead>
                    <TableCellHead>Status</TableCellHead>
                    <TableCellHead>Valid</TableCellHead>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importRows.slice(0, 15).map((r, i) => (
                    <TableRow key={`${r.sourceUrl}-${i}`}>
                      <TableCellData>
                        <code
                          css={css`
                            font-size: var(--fs-sm);
                          `}
                        >
                          {r.sourceUrl || '—'}
                        </code>
                      </TableCellData>
                      <TableCellData>
                        <code
                          css={css`
                            font-size: var(--fs-sm);
                          `}
                        >
                          {r.targetUrl || '—'}
                        </code>
                      </TableCellData>
                      <TableCellData>{r.targetStatusCode ?? '—'}</TableCellData>
                      <TableCellData>
                        {r.issues.filter(isBlocking).length === 0 ? (
                          r.issues.length > 0 ? (
                            <Chip theme="utility-caution" text={r.issues[0]} />
                          ) : (
                            <Chip theme="utility-success" text="Valid" />
                          )
                        ) : (
                          <Chip theme="utility-danger" text={r.issues[0]} />
                        )}
                      </TableCellData>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {importRows.length > 15 ? (
                <p
                  css={css`
                    margin: var(--spacing-xs) 0 0;
                    font-size: var(--fs-sm);
                    color: var(--typography-light);
                  `}
                >
                  Showing the first 15 of {importRows.length} rows.
                </p>
              ) : null}
            </ResponsiveTableContainer>

            <div
              css={css`
                display: flex;
                gap: var(--spacing-sm);
              `}
            >
              <Button
                buttonType="primary"
                disabled={importing || validRows.length === 0}
                onClick={handleImport}
              >
                <Icon icon="software-upload" size="1rem" />
                {importing ? 'Importing…' : `Import ${validRows.length} redirects into Uniform`}
              </Button>
              <Button
                buttonType="ghost"
                disabled={importing}
                onClick={() => {
                  setImportRows(null);
                  setImportFileName('');
                  setImportResult(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : null}

        {importResult ? (
          importResult.errors.length === 0 ? (
            <Banner type="success">Successfully imported {importResult.succeeded} redirects.</Banner>
          ) : (
            <Banner type="danger">
              Imported {importResult.succeeded} redirects, {importResult.errors.length} failed.
              First error: {importResult.errors[0].sourceUrl} — {importResult.errors[0].message}
            </Banner>
          )
        ) : null}
      </section>
    </Stack>
  );
}
