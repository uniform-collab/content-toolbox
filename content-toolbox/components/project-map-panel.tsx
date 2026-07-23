/** @jsxImportSource @emotion/react */

import { css } from "@emotion/react";
import { useQuery } from "@tanstack/react-query";
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
} from "@uniformdev/mesh-sdk-react";
import {
  Banner,
  Button,
  Caption,
  CheckboxWithInfo,
  Chip,
  Details,
  DismissibleChipAction,
  Icon,
  InputKeywordSearch,
  InputSelect,
  Link,
  ResponsiveTableContainer,
  StatusBullet,
  Table,
  TableBody,
  TableCellData,
  TableCellHead,
  TableHead,
  TableRow,
  toast,
} from "@uniformdev/design-system";
import { useMemo, useState } from "react";

import { headerIndex, parseCsv, toCsv } from "../lib/csv";
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
} from "./tool-shared";
import { Stack } from "./ui";

type PublishStatus = "Published" | "Modified" | "Draft" | "Unknown";

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
  type: "composition" | "placeholder";
  order?: number;
  description?: string;
  compositionId?: string;
  issues: string[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as ProjectMapPayload;
};

export function useProjectMapQuery(projectId: string) {
  return useQuery<ProjectMapPayload, Error>({
    queryKey: ["project-map", projectId],
    queryFn: () =>
      fetcher(
        `/api/uniform/project-map?projectId=${encodeURIComponent(projectId)}`,
      ),
    refetchOnWindowFocus: false,
    retry: false,
  });
}

const BASE_COLUMNS: {
  header: string;
  csv: (n: ExportNode) => string | number;
}[] = [
  { header: "Node Name", csv: (n) => n.name },
  { header: "Node Type", csv: (n) => n.type },
  { header: "Path", csv: (n) => n.path },
  { header: "Description", csv: (n) => n.description ?? "" },
  { header: "Order", csv: (n) => n.order ?? "" },
  { header: "Node ID", csv: (n) => n.id },
  { header: "Composition ID", csv: (n) => n.compositionId ?? "" },
  { header: "Composition Name", csv: (n) => n.compositionName ?? "" },
  { header: "Composition Type", csv: (n) => n.compositionType ?? "" },
  { header: "Publish Status", csv: (n) => n.publishStatus },
];

const BASE_HEADERS = BASE_COLUMNS.map((c) => c.header);

/** Columns the importer needs to match rows back to nodes. */
const REIMPORT_REQUIRED = new Set(["Node Name", "Node Type", "Path"]);

const SEO_PARAM_NAMES = new Set(
  [
    "pageTitle",
    "metaDescription",
    "metaRobots",
    "ogTitle",
    "ogDescription",
    "ogImage",
    "ogType",
    "schemaType",
    "canonicalUrl",
    "twitterTitle",
    "twitterDescription",
    "twitterImage",
  ].map((k) => k.toLowerCase()),
);

function parseImportCsv(text: string): { rows: ImportRow[]; error?: string } {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    return { rows: [], error: "The CSV file has no data rows." };
  }
  const headers = headerIndex(parsed[0]);
  const col = (key: string) => headers.get(key);

  const nameCol = col("nodename") ?? col("name");
  const pathCol = col("path") ?? col("url");
  const typeCol = col("nodetype") ?? col("type");
  if (nameCol === undefined || pathCol === undefined || typeCol === undefined) {
    return {
      rows: [],
      error:
        'Could not find required columns. Expected headers: "Node Name", "Path", "Node Type" (matching the exported format).',
    };
  }
  const idCol = col("nodeid");
  const descCol = col("description");
  const orderCol = col("order");
  const compIdCol = col("compositionid");

  const rows: ImportRow[] = parsed.slice(1).map((cells, i) => {
    const get = (c: number | undefined) =>
      c !== undefined ? (cells[c] ?? "").trim() : "";
    const issues: string[] = [];
    const name = get(nameCol);
    const path = get(pathCol);
    const rawType = get(typeCol).toLowerCase();
    const type = (
      rawType === "placeholder" ? "placeholder" : "composition"
    ) as ImportRow["type"];

    if (!name) issues.push("Missing node name");
    if (!path || !path.startsWith("/")) {
      issues.push('Path must start with "/"');
    }
    if (rawType && rawType !== "composition" && rawType !== "placeholder") {
      issues.push(
        `Unknown node type "${rawType}" (use "composition" or "placeholder")`,
      );
    }

    const orderRaw = get(orderCol);
    const order = orderRaw === "" ? undefined : Number.parseInt(orderRaw, 10);
    if (orderRaw !== "" && Number.isNaN(order))
      issues.push("Order is not a number");

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

/** Classify a CSV row against the live project map and describe the change. */
function classifyRows(rows: ImportRow[], nodes: ExportNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const byPath = new Map(nodes.map((n) => [n.path, n]));
  const norm = (v: string | undefined) => v ?? "";

  const previewRows: ImportPreviewRow[] = [];
  const changedRows: ImportRow[] = [];
  let unchanged = 0;

  rows.forEach((row, i) => {
    if (row.issues.length > 0) {
      previewRows.push({
        action: "error",
        name: row.name || `Row ${i + 2}`,
        detail: row.issues.join("; "),
      });
      return;
    }

    const existing =
      (row.id ? byId.get(row.id) : undefined) ?? byPath.get(row.path);
    if (!existing) {
      previewRows.push({
        action: "create",
        name: row.name,
        detail: `New ${row.type} node at ${row.path}`,
      });
      changedRows.push(row);
      return;
    }

    const changes: string[] = [];
    if (row.name !== existing.name)
      changes.push(`Node name: "${existing.name}" → "${row.name}"`);
    if (row.type !== existing.type)
      changes.push(`Type: ${existing.type} → ${row.type}`);
    if (row.path !== existing.path)
      changes.push(`Path: ${existing.path} → ${row.path}`);
    if (norm(row.description) !== norm(existing.description)) {
      changes.push(
        row.description ? "Description updated" : "Description removed",
      );
    }
    if (row.order !== undefined && row.order !== existing.order) {
      changes.push(`Order: ${existing.order ?? "—"} → ${row.order}`);
    }
    if (norm(row.compositionId) !== norm(existing.compositionId)) {
      changes.push("Composition changed");
    }

    if (changes.length === 0) {
      unchanged += 1;
      return;
    }
    previewRows.push({
      action: "update",
      name: existing.name,
      detail: changes.join("; "),
    });
    changedRows.push({ ...row, id: existing.id });
  });

  return { previewRows, changedRows, unchanged };
}

/** Header-cell label with a checkbox controlling whether the column is exported. */
function ColumnHeadLabel({
  label,
  checked,
  mono,
  onToggle,
}: {
  label: string;
  checked: boolean;
  mono?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      css={css`
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-2xs);
        white-space: nowrap;
        cursor: pointer;
        opacity: ${checked ? 1 : 0.5};
      `}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Include the "${label}" column in the CSV export`}
      />
      {mono ? (
        <code
          css={css`
            font-size: var(--fs-xs);
          `}
        >
          {label}
        </code>
      ) : (
        label
      )}
    </label>
  );
}

function TruncatedText({
  value,
  mono,
  maxWidth = "220px",
}: {
  value: string;
  mono?: boolean;
  maxWidth?: string;
}) {
  const content = (
    <span
      title={value}
      css={css`
        display: inline-block;
        max-width: ${maxWidth};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        vertical-align: bottom;
      `}
    >
      {value}
    </span>
  );
  if (!mono) return content;
  return (
    <code
      css={css`
        font-size: var(--fs-sm);
      `}
    >
      {content}
    </code>
  );
}

const DASH = (
  <span
    css={css`
      color: var(--typography-light);
    `}
  >
    —
  </span>
);

/** Preview rendering for one base CSV column of a node. */
function BaseCellValue({ header, node }: { header: string; node: ExportNode }) {
  const comp = node.type === "composition";
  switch (header) {
    case "Node Name":
      return <>{node.name}</>;
    case "Node Type":
      return (
        <Chip
          size="xs"
          variant="outlined"
          theme={comp ? "accent-alt-dark" : "neutral-light"}
          text={node.type}
        />
      );
    case "Path":
      return (
        <code
          css={css`
            font-size: var(--fs-sm);
          `}
        >
          {node.path}
        </code>
      );
    case "Description":
      return node.description ? (
        <TruncatedText value={node.description} />
      ) : (
        DASH
      );
    case "Order":
      return node.order !== undefined ? <>{node.order}</> : DASH;
    case "Node ID":
      return <TruncatedText value={node.id} mono maxWidth="14ch" />;
    case "Composition ID":
      return node.compositionId ? (
        <TruncatedText value={node.compositionId} mono maxWidth="14ch" />
      ) : (
        DASH
      );
    case "Composition Name":
      return node.compositionName ? <>{node.compositionName}</> : DASH;
    case "Composition Type":
      return node.compositionType ? <>{node.compositionType}</> : DASH;
    case "Publish Status":
      return comp && node.publishStatus !== "Unknown" ? (
        <StatusBullet
          status={node.publishStatus}
          message={node.publishStatus}
          size="sm"
        />
      ) : (
        DASH
      );
    default:
      return DASH;
  }
}

const PAGE_SIZE = 10;

export function ProjectMapPanel({ projectId }: { projectId: string }) {
  const { data, error, isLoading, refetch } = useProjectMapQuery(projectId);

  const [selected, setSelected] = useState<string[]>([]);
  const [paramSearch, setParamSearch] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  /** Base column headers unchecked in the preview — excluded from the CSV export. */
  const [excludedBase, setExcludedBase] = useState<Set<string>>(new Set());

  const [importStage, setImportStage] = useState<"idle" | "preview" | "done">(
    "idle",
  );
  const [importFileName, setImportFileName] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [doneSummary, setDoneSummary] = useState("");
  const [doneErrorDetail, setDoneErrorDetail] = useState<string | undefined>(
    undefined,
  );

  const paramList = useMemo(() => {
    if (!data) return [];
    const q = paramSearch.trim().toLowerCase();
    return q
      ? data.parameterKeys.filter((k) => k.toLowerCase().includes(q))
      : data.parameterKeys;
  }, [data, paramSearch]);

  const toggleParam = (key: string) =>
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key].sort(),
    );

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.nodes.filter(
      (n) =>
        (!q ||
          n.name.toLowerCase().includes(q) ||
          n.path.toLowerCase().includes(q) ||
          (n.compositionName ?? "").toLowerCase().includes(q)) &&
        (typeFilter === "all" || n.type === typeFilter) &&
        (statusFilter === "all" || n.publishStatus === statusFilter),
    );
  }, [data, search, typeFilter, statusFilter]);

  const safeOffset = clampOffset(offset, filteredNodes.length, PAGE_SIZE);
  const pageNodes = filteredNodes.slice(safeOffset, safeOffset + PAGE_SIZE);

  const classified = useMemo(
    () =>
      data && importStage === "preview"
        ? classifyRows(importRows, data.nodes)
        : null,
    [data, importStage, importRows],
  );

  const activeBase = useMemo(
    () => BASE_COLUMNS.filter((c) => !excludedBase.has(c.header)),
    [excludedBase],
  );

  const toggleBaseColumn = (header: string) =>
    setExcludedBase((prev) => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header);
      else next.add(header);
      return next;
    });

  const columnCount = activeBase.length + selected.length;

  const handleExport = () => {
    if (!data || columnCount === 0) return;
    const params = data.parameterKeys.filter((k) => selected.includes(k));
    const header = [
      ...activeBase.map((c) => c.header),
      ...params.map((k) => `Param: ${k}`),
    ];
    const rows = data.nodes.map((n) => [
      ...activeBase.map((c) => c.csv(n)),
      ...params.map((k) => n.parameters[k] ?? ""),
    ]);
    downloadCsv(
      `project-map-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([header, ...rows]),
    );
    toast.success(
      `Exported ${data.nodes.length} nodes, ${header.length} columns.`,
    );
  };

  const handleTemplate = (e: React.MouseEvent) => {
    e.preventDefault();
    downloadCsv(
      "project-map-template.csv",
      toCsv([
        [
          "Node ID",
          "Node Name",
          "Node Type",
          "Path",
          "Description",
          "Order",
          "Composition ID",
        ],
        ["", "Example Page", "composition", "/example", "", "1", ""],
      ]),
    );
    toast.success("Template downloaded.");
  };

  const handleFile = (name: string, text: string) => {
    const { rows, error: parseError } = parseImportCsv(text);
    if (parseError) {
      setImportError(parseError);
      return;
    }
    setImportError(null);
    setImportRows(rows);
    setImportFileName(name);
    setImportStage("preview");
  };

  const resetImport = () => {
    setImportStage("idle");
    setImportRows([]);
    setImportError(null);
  };

  const handleApply = async () => {
    if (!data || !classified || classified.changedRows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/uniform/project-map", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
        },
        body: JSON.stringify({
          projectId,
          projectMapId: data.projectMap.id,
          nodes: classified.changedRows.map(
            ({ issues: _issues, ...node }) => node,
          ),
        }),
      });
      const result = (await res.json()) as {
        succeeded: number;
        errors: { path: string; message: string }[];
        error?: string;
      };
      if (!res.ok)
        throw new Error(result.error ?? `Import failed (${res.status})`);

      const updates = classified.previewRows.filter(
        (r) => r.action === "update",
      ).length;
      const creates = classified.previewRows.filter(
        (r) => r.action === "create",
      ).length;
      const skipped = classified.previewRows.filter(
        (r) => r.action === "error",
      ).length;
      setDoneSummary(
        `${result.succeeded} of ${updates + creates} changes written (${updates} updates, ${creates} new)` +
          (skipped ? `, ${skipped} rows skipped due to errors.` : "."),
      );
      setDoneErrorDetail(
        result.errors.length > 0
          ? `${result.errors.length} failed — first error: ${result.errors[0].path}: ${result.errors[0].message}`
          : undefined,
      );
      setImportStage("done");
      if (result.errors.length === 0) {
        toast.success(`Imported ${result.succeeded} nodes into Uniform.`);
      } else {
        toast.warning(
          `Imported ${result.succeeded} nodes; ${result.errors.length} failed.`,
        );
      }
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  if (error) {
    return (
      <Banner type="danger">
        Could not load the project map: {error.message}
      </Banner>
    );
  }

  const basePart =
    excludedBase.size === 0
      ? `All ${BASE_COLUMNS.length} base columns`
      : `${activeBase.length} of ${BASE_COLUMNS.length} base columns`;
  const paramsSummary =
    selected.length === 0
      ? `${basePart}, no extra parameters`
      : `${basePart}, ${selected.length} extra: ${selected.join(", ")}`;

  return (
    <Stack gap="var(--spacing-lg)">
      {/* ------- Export ------- */}
      <PanelSection label="Export project map">
        <SectionHeader
          title="Export project map to CSV"
          description={
            data
              ? `Project map "${data.projectMap.name}". Every node exports with ${BASE_HEADERS.length} base columns; add composition parameters below.`
              : "Loads all project map nodes with composition details and publish status."
          }
          actions={
            <>
              <Button
                buttonType="primary"
                disabled={!data || columnCount === 0}
                onClick={handleExport}
              >
                <Icon
                  icon="software-download"
                  size="1rem"
                  iconColor="currentColor"
                />
                Download CSV
              </Button>
              {data ? (
                <Caption>
                  {columnCount} columns × {data.nodes.length} rows
                </Caption>
              ) : null}
            </>
          }
        />

        {isLoading ? (
          <LoadingRow label="Loading project map, compositions, and publish status…" />
        ) : null}

        {data ? (
          <>
            <Details
              summary={
                <span
                  css={css`
                    display: inline-flex;
                    align-items: baseline;
                    gap: var(--spacing-sm);
                    width: max-content;
                    max-width: 100%;
                  `}
                >
                  <strong
                    css={css`
                      white-space: nowrap;
                    `}
                  >
                    Add composition parameters to export
                  </strong>
                  <span
                    css={css`
                      font-size: var(--fs-sm);
                      color: var(--typography-light);
                      flex: none;
                      max-width: 56ch;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    `}
                  >
                    {paramsSummary}
                  </span>
                </span>
              }
            >
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: var(--spacing-md);
                  padding-top: var(--spacing-sm);
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
                  <span
                    css={css`
                      font-size: var(--fs-sm);
                      color: var(--typography-light);
                    `}
                  >
                    Pick composition parameters to append after the{" "}
                    {BASE_HEADERS.length} base columns.
                  </span>
                  <div
                    css={css`
                      display: flex;
                      gap: var(--spacing-2xs);
                    `}
                  >
                    <Button
                      buttonType="ghost"
                      size="sm"
                      onClick={() =>
                        setSelected(
                          data.parameterKeys
                            .filter((k) => SEO_PARAM_NAMES.has(k.toLowerCase()))
                            .sort(),
                        )
                      }
                    >
                      SEO set
                    </Button>
                    <Button
                      buttonType="ghost"
                      size="sm"
                      onClick={() =>
                        setSelected([...data.parameterKeys].sort())
                      }
                    >
                      All
                    </Button>
                    <Button
                      buttonType="ghost"
                      size="sm"
                      onClick={() => setSelected([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div
                  css={css`
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: var(--spacing-2xs);
                  `}
                >
                  {selected.map((name) => (
                    <Chip
                      key={name}
                      text={name}
                      size="xs"
                      variant="outlined"
                      theme="accent-light"
                      chipAction={
                        <DismissibleChipAction
                          onDismiss={() => toggleParam(name)}
                        />
                      }
                    />
                  ))}
                  {selected.length === 0 ? (
                    <span
                      css={css`
                        font-size: var(--fs-sm);
                        color: var(--typography-light);
                      `}
                    >
                      No parameters selected. Search below or use a preset.
                    </span>
                  ) : null}
                </div>

                <InputKeywordSearch
                  aria-label="Search parameters"
                  placeholder="Search parameters to add (e.g. pageTitle, ogImage)…"
                  value={paramSearch}
                  onSearchTextChanged={setParamSearch}
                  onClear={() => setParamSearch("")}
                  disabledFieldSubmission
                />

                <div
                  css={css`
                    display: grid;
                    grid-template-columns: repeat(
                      auto-fill,
                      minmax(230px, 1fr)
                    );
                    gap: var(--spacing-2xs) var(--spacing-md);
                    max-height: 220px;
                    overflow-y: auto;
                    padding: var(--spacing-xs);
                    border: 1px solid var(--gray-100);
                    border-radius: var(--rounded-md);
                  `}
                >
                  {paramList.map((key) => (
                    <CheckboxWithInfo
                      key={key}
                      name={`param-${key}`}
                      label={key}
                      checked={selected.includes(key)}
                      onChange={() => toggleParam(key)}
                    />
                  ))}
                  {paramList.length === 0 ? (
                    <span
                      css={css`
                        font-size: var(--fs-sm);
                        color: var(--typography-light);
                      `}
                    >
                      No parameters match "{paramSearch}".
                    </span>
                  ) : null}
                </div>
              </div>
            </Details>

            <Details
              summary={
                <span
                  css={css`
                    display: inline-flex;
                    align-items: baseline;
                    gap: var(--spacing-sm);
                    width: max-content;
                    max-width: 100%;
                  `}
                >
                  <strong
                    css={css`
                      white-space: nowrap;
                    `}
                  >
                    Export preview
                  </strong>
                  <span
                    css={css`
                      font-size: var(--fs-sm);
                      color: var(--typography-light);
                      flex: none;
                      max-width: 56ch;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    `}
                  >
                    {excludedBase.size > 0
                      ? `${excludedBase.size} columns unchecked and excluded from the export`
                      : "See what you are exporting before you download"}
                  </span>
                </span>
              }
            >
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: var(--spacing-md);
                  padding-top: var(--spacing-sm);
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
                  <div
                    css={css`
                      flex: 1 1 240px;
                    `}
                  >
                    <InputKeywordSearch
                      aria-label="Filter nodes"
                      placeholder="Filter nodes by name or path…"
                      value={search}
                      onSearchTextChanged={(v) => {
                        setSearch(v);
                        setOffset(0);
                      }}
                      onClear={() => {
                        setSearch("");
                        setOffset(0);
                      }}
                      disabledFieldSubmission
                    />
                  </div>
                  <InputSelect
                    label="Node type"
                    showLabel={false}
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setOffset(0);
                    }}
                    options={[
                      { label: "All types", value: "all" },
                      { label: "Compositions", value: "composition" },
                      { label: "Placeholders", value: "placeholder" },
                    ]}
                  />
                  <InputSelect
                    label="Publish status"
                    showLabel={false}
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setOffset(0);
                    }}
                    options={[
                      { label: "Any status", value: "all" },
                      { label: "Published", value: "Published" },
                      { label: "Modified", value: "Modified" },
                      { label: "Draft", value: "Draft" },
                    ]}
                  />
                  <Caption>
                    {filteredNodes.length} of {data.nodes.length} nodes
                  </Caption>
                </div>

                <ResponsiveTableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        {BASE_COLUMNS.map((c) => (
                          <TableCellHead key={c.header}>
                            <ColumnHeadLabel
                              label={c.header}
                              checked={!excludedBase.has(c.header)}
                              onToggle={() => toggleBaseColumn(c.header)}
                            />
                          </TableCellHead>
                        ))}
                        {selected.map((key) => (
                          <TableCellHead key={key}>
                            <ColumnHeadLabel
                              label={key}
                              mono
                              checked
                              onToggle={() => toggleParam(key)}
                            />
                          </TableCellHead>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pageNodes.map((n) => (
                        <TableRow key={n.id}>
                          {BASE_COLUMNS.map((c) => (
                            <TableCellData key={c.header}>
                              <span
                                css={css`
                                  opacity: ${excludedBase.has(c.header)
                                    ? 0.4
                                    : 1};
                                `}
                              >
                                <BaseCellValue header={c.header} node={n} />
                              </span>
                            </TableCellData>
                          ))}
                          {selected.map((key) => {
                            const value = n.parameters[key] ?? "";
                            return (
                              <TableCellData key={key}>
                                {value ? <TruncatedText value={value} /> : DASH}
                              </TableCellData>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredNodes.length === 0 ? (
                    <p
                      css={css`
                        margin: 0;
                        padding: var(--spacing-lg);
                        text-align: center;
                        font-size: var(--fs-sm);
                        color: var(--typography-light);
                      `}
                    >
                      No nodes match your filters.{" "}
                      <Link
                        text="Clear filters"
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSearch("");
                          setTypeFilter("all");
                          setStatusFilter("all");
                          setOffset(0);
                        }}
                      />
                    </p>
                  ) : null}
                  <PaginationFooter
                    total={filteredNodes.length}
                    pageSize={PAGE_SIZE}
                    offset={safeOffset}
                    onOffsetChange={setOffset}
                  />
                </ResponsiveTableContainer>
                <Caption>
                  Filters affect this preview only — the CSV always exports all{" "}
                  {data.nodes.length} nodes. Uncheck column headers to trim it
                  to {columnCount} columns.
                </Caption>
                {[...REIMPORT_REQUIRED].some((c) => excludedBase.has(c)) ? (
                  <Caption>
                    Note: Node Name, Node Type, and Path are required if you
                    plan to re-import this CSV.
                  </Caption>
                ) : null}
              </div>
            </Details>
          </>
        ) : null}
      </PanelSection>

      {/* ------- Import ------- */}
      <PanelSection label="Import project map">
        <SectionHeader
          title="Import project map from CSV"
          description={
            <>
              Rows match existing nodes by Node ID, or by path when no ID is
              given. You will review every change before anything is written.{" "}
              <Link
                text="Download a template CSV"
                href="#"
                onClick={handleTemplate}
              />
            </>
          }
        />

        {importError ? <Banner type="danger">{importError}</Banner> : null}

        {importStage === "idle" ? (
          <CsvDropzone disabled={!data} onFile={handleFile} />
        ) : null}

        {importStage === "preview" && classified ? (
          <ImportPreview
            fileName={importFileName}
            rows={classified.previewRows}
            unchangedCount={classified.unchanged}
            applying={importing}
            onCancel={resetImport}
            onApply={handleApply}
          />
        ) : null}

        {importStage === "done" ? (
          <ImportDone
            summary={doneSummary}
            errorDetail={doneErrorDetail}
            onReset={resetImport}
          />
        ) : null}
      </PanelSection>
    </Stack>
  );
}
