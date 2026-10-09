import type { NextApiRequest, NextApiResponse } from 'next';

import { requireMeshCsrf } from '../../../lib/csrf';
import { loadMeshDelegationSession } from '../../../lib/delegationSession';
import { importBlockedMessage, isImportAllowed } from '../../../lib/importGuard';
import {
  getAllCompositions,
  getComponentDefinitions,
  getProjectMapNodes,
  getProjectMaps,
  upsertProjectMapNodes,
  type CanvasParameter,
  type NodeUpsert,
  type UniformAuth,
} from '../../../lib/uniform';

export const config = {
  maxDuration: 300,
};

export type PublishStatus = 'Published' | 'Modified' | 'Draft' | 'Unknown';

export interface ExportNode {
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
  parameters: Record<string, ExportParameterValue>;
}

/** A flattened parameter value. Localized parameters fill `locales` instead of `value`. */
export interface ExportParameterValue {
  value?: string;
  locales?: Record<string, string>;
}

/** A composition parameter that is used by at least one composition in the project map. */
export interface ExportParameter {
  key: string;
  /** Display name from the component definition, or the key when no definition names it. */
  label: string;
  /** Display names of the composition types that have this parameter. */
  compositionTypes: string[];
  /** Number of project map nodes that have a non-empty value (in any locale). */
  pageCount: number;
  localized: boolean;
}

export interface ProjectMapExportPayload {
  projectMap: { id: string; name: string };
  parameters: ExportParameter[];
  /** Locales that occur in localized parameter values, sorted. */
  locales: string[];
  nodes: ExportNode[];
}

/** Parameters with this prefix are Uniform system parameters ($viz, $tstVrnt…), not content. */
const SYSTEM_PARAM_PREFIX = '$';

function flattenValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function flattenParameter(param: CanvasParameter | undefined): ExportParameterValue {
  if (!param) return {};
  if (param.locales && Object.keys(param.locales).length > 0) {
    return {
      locales: Object.fromEntries(
        Object.entries(param.locales).map(([locale, v]) => [locale, flattenValue(v)])
      ),
    };
  }
  return { value: flattenValue(param.value) };
}

function hasContent(v: ExportParameterValue): boolean {
  if (v.value) return true;
  return Object.values(v.locales ?? {}).some(Boolean);
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, auth: UniformAuth) {
  const maps = await getProjectMaps(auth);
  const projectMap = maps.find((m) => m.default) ?? maps[0];
  if (!projectMap) {
    res.status(404).json({ error: 'No project map found in this project.' });
    return;
  }

  const [nodes, drafts, published, definitions] = await Promise.all([
    getProjectMapNodes(auth, projectMap.id),
    getAllCompositions(auth, 0),
    getAllCompositions(auth, 64),
    // Display names are a nice-to-have: export still works without them.
    getComponentDefinitions(auth).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Could not load component definitions', err);
      return [];
    }),
  ]);

  const publishedById = new Map(published.map((c) => [c.composition._id, c.modified]));
  const draftById = new Map(drafts.map((c) => [c.composition._id, c]));
  const definitionById = new Map(definitions.map((d) => [d.public_id, d]));

  /** Parameter stats, built only from compositions attached to this project map. */
  const paramStats = new Map<
    string,
    { label?: string; compositionTypes: Set<string>; pageCount: number; localized: boolean }
  >();
  const localeSet = new Set<string>();

  const exportNodes: ExportNode[] = nodes.map((node) => {
    let publishStatus: PublishStatus = 'Unknown';
    const parameters: Record<string, ExportParameterValue> = {};
    let compositionName: string | undefined;
    let compositionType: string | undefined;

    if (node.type === 'placeholder' || !node.compositionId) {
      publishStatus = 'Unknown';
    } else {
      const draft = draftById.get(node.compositionId);
      const publishedModified = publishedById.get(node.compositionId);
      compositionName = draft?.composition._name ?? node.compositionData?.name;
      compositionType =
        node.compositionData?.typeName ?? draft?.composition.type ?? node.compositionData?.type;

      if (!publishedModified) {
        publishStatus = 'Draft';
      } else if (draft && draft.modified > publishedModified) {
        publishStatus = 'Modified';
      } else {
        publishStatus = 'Published';
      }

      if (draft && !draft.pattern) {
        const definition = definitionById.get(draft.composition.type);
        const typeLabel = definition?.name ?? compositionType ?? draft.composition.type;
        for (const [key, param] of Object.entries(draft.composition.parameters ?? {})) {
          if (key.startsWith(SYSTEM_PARAM_PREFIX)) continue;
          const flat = flattenParameter(param);
          parameters[key] = flat;

          const stats = paramStats.get(key) ?? {
            compositionTypes: new Set<string>(),
            pageCount: 0,
            localized: false,
          };
          stats.label ??= definition?.parameters?.find((p) => p.id === key)?.name;
          stats.compositionTypes.add(typeLabel);
          if (hasContent(flat)) stats.pageCount += 1;
          if (flat.locales) {
            stats.localized = true;
            Object.keys(flat.locales).forEach((l) => localeSet.add(l));
          }
          paramStats.set(key, stats);
        }
      }
    }

    return {
      id: node.id,
      name: node.name,
      type: node.type,
      path: node.path,
      order: node.order,
      description: node.description,
      compositionId: node.compositionId,
      compositionName,
      compositionType,
      publishStatus,
      parameters,
    };
  });

  const payload: ProjectMapExportPayload = {
    projectMap: { id: projectMap.id, name: projectMap.name },
    parameters: Array.from(paramStats.entries())
      .map(([key, stats]) => ({
        key,
        label: stats.label ?? key,
        compositionTypes: Array.from(stats.compositionTypes).sort(),
        pageCount: stats.pageCount,
        localized: stats.localized,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    locales: Array.from(localeSet).sort(),
    nodes: exportNodes,
  };
  res.status(200).json(payload);
}

interface ImportBody {
  projectId?: string;
  projectMapId: string;
  nodes: NodeUpsert[];
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, auth: UniformAuth) {
  if (!(await isImportAllowed(auth, 'allowProjectMapImport'))) {
    res.status(403).json({ error: importBlockedMessage('project map') });
    return;
  }

  const body = req.body as ImportBody;
  if (!body?.projectMapId || !Array.isArray(body.nodes)) {
    res.status(400).json({ error: 'Expected { projectMapId, nodes } in request body.' });
    return;
  }

  const invalid = body.nodes.filter(
    (n) =>
      !n.name?.trim() ||
      !n.path?.trim() ||
      (n.type !== 'composition' && n.type !== 'placeholder')
  );
  if (invalid.length > 0) {
    res.status(400).json({
      error: `${invalid.length} row(s) are missing a valid name, path, or type (composition | placeholder).`,
    });
    return;
  }

  const nodes: NodeUpsert[] = body.nodes.map((n) => ({
    ...(n.id ? { id: n.id } : {}),
    name: n.name.trim(),
    path: n.path.trim(),
    type: n.type,
    ...(n.order !== undefined && n.order !== null ? { order: n.order } : {}),
    ...(n.description?.trim() ? { description: n.description.trim() } : {}),
    ...(n.compositionId?.trim() ? { compositionId: n.compositionId.trim() } : {}),
  }));

  const result = await upsertProjectMapNodes(auth, body.projectMapId, nodes);
  res.status(200).json(result);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // User-scoped data must never be cached by a CDN or shared proxy.
    res.setHeader('Cache-Control', 'no-store, private');

    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: `Method ${req.method} not allowed.` });
      return;
    }

    // Writes need CSRF protection because the delegation cookie is SameSite=None.
    if (req.method === 'POST' && !requireMeshCsrf(req, res)) {
      return;
    }

    const session = await loadMeshDelegationSession(req, res);
    if (!session) {
      res.status(401).json({ error: 'No active delegation session.' });
      return;
    }

    const projectId =
      req.method === 'GET' ? req.query.projectId : (req.body as ImportBody | undefined)?.projectId;
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId is required.' });
      return;
    }

    const auth: UniformAuth = { projectId, bearerToken: session.accessToken };
    if (req.method === 'GET') {
      await handleGet(req, res, auth);
    } else {
      await handlePost(req, res, auth);
    }
  } catch (err) {
    // Upstream error bodies can contain internal detail — log them, return a generic message.
    // eslint-disable-next-line no-console
    console.error('Project map route failed', err);
    res.status(500).json({ error: 'The request failed. Check the server log for details.' });
  }
}
