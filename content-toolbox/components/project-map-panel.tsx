/** @jsxImportSource @emotion/react */

import { css } from '@emotion/react';
import { useQuery } from '@tanstack/react-query';
import {
  Banner,
  Button,
  Callout,
  CheckboxWithInfo,
  Chip,
  Icon,
  InputKeywordSearch,
  ResponsiveTableContainer,
  StatusBullet,
  Table,
  TableBody,
  TableCellData,
  TableCellHead,
  TableHead,
  TableRow,
  toast,
} from '@uniformdev/design-system';
import { useMemo, useState } from 'react';

import { headerIndex, parseCsv, toCsv } from '../lib/csv';
import { CsvFilePicker, downloadCsv, LoadingRow, PanelHeader } from './tool-shared';
import { Stack } from './ui';

type PublishStatus = 'Published' | 'Modified' | 'Draft' | 'Unknown';

interface ExportNode {
  id: string;
  name: string;
  type: string;
  path: string;
  order?: number;
  description?: string;
  compositionId?: string;
  compositionName?: string;
  compositionType?: string;
  publishStatus: PublishStatus;
  parameters: Record<string, string>;
}

interface ProjectMapPayload {
  projectMap: { id: string; name: string };
  parameterKeys: string[];
  nodes: ExportNode[];
}

interface ImportRow {
  id?: string;
  name: string;
  path: string;
  type: 'composition' | 'placeholder';
  order?: number;
  description?: string;
  compositionId?: string;
  issues: string[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as ProjectMapPayload;
};

const BASE_HEADERS = [
  'Node Name',
  'Node Type',
  'Path',
  'Description',
  'Order',
  'Node ID',
  'Composition ID',
  'Composition Name',
  'Composition Type',
  'Publish Status',
];

function parseImportCsv(text: string): { rows: ImportRow[]; error?: string } {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    return { rows: [], error: 'The CSV file has no data rows.' };
  }
  const headers = headerIndex(parsed[0]);
  const col = (key: string) => headers.get(key);

  const nameCol = col('nodename') ?? col('name');
  const pathCol = col('path') ?? col('url');
  const typeCol = col('nodetype') ?? col('type');
  if (nameCol === undefined || pathCol === undefined || typeCol === undefined) {
    return {
      rows: [],
      error:
        'Could not find required columns. Expected headers: "Node Name", "Path", "Node Type" (matching the exported format).',
    };
  }
  const idCol = col('nodeid');
  const descCol = col('description');
  const orderCol = col('order');
  const compIdCol = col('compositionid');

  const rows: ImportRow[] = parsed.slice(1).map((cells, i) => {
    const get = (c: number | undefined) => (c !== undefined ? (cells[c] ?? '').trim() : '');
    const issues: string[] = [];
    const name = get(nameCol);
    const path = get(pathCol);
    const rawType = get(typeCol).toLowerCase();
    const type = (rawType === 'placeholder' ? 'placeholder' : 'composition') as ImportRow['type'];

    if (!name) issues.push('Missing node name');
    if (!path || !path.startsWith('/')) {
      issues.push('Path must start with "/"');
    }
    if (rawType && rawType !== 'composition' && rawType !== 'placeholder') {
      issues.push(`Unknown type "${rawType}" (row ${i + 2})`);
    }

    const orderRaw = get(orderCol);
    const order = orderRaw === '' ? undefined : Number.parseInt(orderRaw, 10);
    if (orderRaw !== '' && Number.isNaN(order)) issues.push('Order is not a number');

    return {
      id: get(idCol) || undefined,
      name,
      path,
      type,
      order: Number.isNaN(order) ? undefined : order,
      description: get(descCol) || undefined,
      compositionId: get(compIdCol) || undefined,
      issues,
    };
  });

  return { rows };
}

export function ProjectMapPanel({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useQuery<ProjectMapPayload, Error>({
    queryKey: ['project-map', projectId],
    queryFn: () => fetcher(`/api/uniform/project-map?projectId=${encodeURIComponent(projectId)}`),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [selectedParams, setSelectedParams] = useState<Set<string>>(new Set());
  const [paramFilter, setParamFilter] = useState('');

  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    succeeded: number;
    errors: { path: string; message: string }[];
  } | null>(null);

  const filteredParams = useMemo(() => {
    if (!data) return [];
    const q = paramFilter.trim().toLowerCase();
    return q ? data.parameterKeys.filter((k) => k.toLowerCase().includes(q)) : data.parameterKeys;
  }, [data, paramFilter]);

  const toggleParam = (key: string) => {
    setSelectedParams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = () => {
    if (!data) return;
    const params = data.parameterKeys.filter((k) => selectedParams.has(k));
    const header = [...BASE_HEADERS, ...params.map((k) => `Param: ${k}`)];
    const rows = data.nodes.map((n) => [
      n.name,
      n.type,
      n.path,
      n.description ?? '',
      n.order ?? '',
      n.id,
      n.compositionId ?? '',
      n.compositionName ?? '',
      n.compositionType ?? '',
      n.publishStatus,
      ...params.map((k) => n.parameters[k] ?? ''),
    ]);
    downloadCsv(
      `project-map-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([header, ...rows])
    );
    toast.success(`Exported ${data.nodes.length} nodes to CSV.`);
  };

  const handleFile = (name: string, text: string) => {
    setImportResult(null);
    const { rows, error: parseError } = parseImportCsv(text);
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

  const validRows = importRows?.filter((r) => r.issues.length === 0) ?? [];
  const invalidRows = importRows?.filter((r) => r.issues.length > 0) ?? [];

  const handleImport = async () => {
    if (!data || validRows.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/uniform/project-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectMapId: data.projectMap.id,
          nodes: validRows.map(({ issues: _issues, ...node }) => node),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? `Import failed (${res.status})`);
      setImportResult(result);
      if (result.errors.length === 0) {
        toast.success(`Imported ${result.succeeded} nodes into Uniform.`);
      } else {
        toast.warning(`Imported ${result.succeeded} nodes; ${result.errors.length} failed.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  if (error) {
    return <Banner type="danger">Could not load the project map: {error.message}</Banner>;
  }

  return (
    <Stack gap="var(--spacing-lg)">
      {/* ------- Export ------- */}
      <section
        aria-label="Export project map"
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
          title="Export project map to CSV"
          description={
            data
              ? `Project map "${data.projectMap.name}" — ${data.nodes.length} nodes. Pick optional composition parameters to include as extra columns.`
              : 'Loads all project map nodes with composition details and publish status.'
          }
          actions={
            <Button buttonType="primary" disabled={!data} onClick={handleExport}>
              <Icon icon="software-download" size="1rem" />
              Download CSV
            </Button>
          }
        />

        {isLoading ? (
          <LoadingRow label="Loading project map, compositions, and publish status…" />
        ) : null}

        {data && data.parameterKeys.length > 0 ? (
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
                gap: var(--spacing-sm);
              `}
            >
              <span
                css={css`
                  font-size: var(--fs-sm);
                  font-weight: 600;
                  color: var(--typography-base);
                `}
              >
                Composition parameters ({selectedParams.size} selected)
              </span>
              <Button
                buttonType="ghost"
                size="sm"
                onClick={() => setSelectedParams(new Set(data.parameterKeys))}
              >
                Select all
              </Button>
              <Button buttonType="ghost" size="sm" onClick={() => setSelectedParams(new Set())}>
                Clear
              </Button>
            </div>
            <InputKeywordSearch
              aria-label="Filter parameters"
              placeholder="Filter parameters…"
              value={paramFilter}
              onSearchTextChanged={setParamFilter}
              onClear={() => setParamFilter('')}
              disabledFieldSubmission
            />
            <div
              css={css`
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
                gap: var(--spacing-2xs) var(--spacing-md);
                max-height: 220px;
                overflow-y: auto;
                padding: var(--spacing-xs);
                border: 1px solid var(--gray-100);
                border-radius: var(--rounded-md);
              `}
            >
              {filteredParams.map((key) => (
                <CheckboxWithInfo
                  key={key}
                  name={`param-${key}`}
                  label={key}
                  checked={selectedParams.has(key)}
                  onChange={() => toggleParam(key)}
                />
              ))}
              {filteredParams.length === 0 ? (
                <span
                  css={css`
                    font-size: var(--fs-sm);
                    color: var(--typography-light);
                  `}
                >
                  No parameters match the filter.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {data ? (
          <ResponsiveTableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCellHead>Node name</TableCellHead>
                  <TableCellHead>Node type</TableCellHead>
                  <TableCellHead>Path</TableCellHead>
                  <TableCellHead>Composition type</TableCellHead>
                  <TableCellHead>Composition name</TableCellHead>
                  <TableCellHead>Publish status</TableCellHead>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.nodes.slice(0, 30).map((n) => (
                  <TableRow key={n.id}>
                    <TableCellData>{n.name}</TableCellData>
                    <TableCellData>
                      <Chip
                        theme={n.type === 'composition' ? 'accent-light' : 'neutral-light'}
                        text={n.type}
                      />
                    </TableCellData>
                    <TableCellData>
                      <code
                        css={css`
                          font-size: var(--fs-sm);
                        `}
                      >
                        {n.path}
                      </code>
                    </TableCellData>
                    <TableCellData>{n.compositionType ?? '—'}</TableCellData>
                    <TableCellData>{n.compositionName ?? '—'}</TableCellData>
                    <TableCellData>
                      {n.publishStatus === 'Unknown' ? (
                        '—'
                      ) : (
                        <StatusBullet status={n.publishStatus} message={n.publishStatus} size="sm" />
                      )}
                    </TableCellData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.nodes.length > 30 ? (
              <p
                css={css`
                  margin: var(--spacing-xs) 0 0;
                  font-size: var(--fs-sm);
                  color: var(--typography-light);
                `}
              >
                Showing the first 30 of {data.nodes.length} nodes. The CSV export includes all
                nodes.
              </p>
            ) : null}
          </ResponsiveTableContainer>
        ) : null}
      </section>

      {/* ------- Import ------- */}
      <section
        aria-label="Import project map"
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
          title="Import project map from CSV"
          description="Upload a modified export. Rows are matched by Node ID (or upserted by path) using columns: Node Name, Node Type, Path, Description, Order, Node ID, Composition ID. Publish status and parameter columns are ignored."
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
                '. Importing updates or creates nodes in Uniform.'}
            </Callout>

            {invalidRows.length > 0 ? (
              <Banner type="caution">
                {invalidRows
                  .slice(0, 5)
                  .map((r) => `${r.path || '(no path)'}: ${r.issues.join('; ')}`)
                  .join(' · ')}
                {invalidRows.length > 5 ? ` · and ${invalidRows.length - 5} more…` : ''}
              </Banner>
            ) : null}

            <ResponsiveTableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCellHead>Node name</TableCellHead>
                    <TableCellHead>Path</TableCellHead>
                    <TableCellHead>Type</TableCellHead>
                    <TableCellHead>Valid</TableCellHead>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importRows.slice(0, 15).map((r, i) => (
                    <TableRow key={`${r.path}-${i}`}>
                      <TableCellData>{r.name || '—'}</TableCellData>
                      <TableCellData>
                        <code
                          css={css`
                            font-size: var(--fs-sm);
                          `}
                        >
                          {r.path || '—'}
                        </code>
                      </TableCellData>
                      <TableCellData>{r.type}</TableCellData>
                      <TableCellData>
                        {r.issues.length === 0 ? (
                          <Chip theme="utility-success" text="Valid" />
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
                {importing ? 'Importing…' : `Import ${validRows.length} nodes into Uniform`}
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
            <Banner type="success">Successfully imported {importResult.succeeded} nodes.</Banner>
          ) : (
            <Banner type="danger">
              Imported {importResult.succeeded} nodes, {importResult.errors.length} failed. First
              error: {importResult.errors[0].path} — {importResult.errors[0].message}
            </Banner>
          )
        ) : null}
      </section>
    </Stack>
  );
}
