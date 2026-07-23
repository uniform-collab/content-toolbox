import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getAllCompositions,
  getProjectMapNodes,
  getProjectMaps,
  resolveProjectId,
  upsertProjectMapNodes,
  type NodeUpsert,
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
  parameters: Record<string, string>;
}

export interface ProjectMapExportPayload {
  projectMap: { id: string; name: string };
  parameterKeys: string[];
  nodes: ExportNode[];
}

function flattenValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const projectId = resolveProjectId(req.query.projectId);

  const maps = await getProjectMaps(projectId);
  const projectMap = maps.find((m) => m.default) ?? maps[0];
  if (!projectMap) {
    res.status(404).json({ error: 'No project map found in this project.' });
    return;
  }

  const [nodes, drafts, published] = await Promise.all([
    getProjectMapNodes(projectId, projectMap.id),
    getAllCompositions(projectId, 0),
    getAllCompositions(projectId, 64),
  ]);

  const publishedById = new Map(published.map((c) => [c.composition._id, c.modified]));
  const draftById = new Map(drafts.map((c) => [c.composition._id, c]));

  const parameterKeySet = new Set<string>();
  for (const draft of drafts) {
    for (const key of Object.keys(draft.composition.parameters ?? {})) {
      parameterKeySet.add(key);
    }
  }

  const exportNodes: ExportNode[] = nodes.map((node) => {
    let publishStatus: PublishStatus = 'Unknown';
    let parameters: Record<string, string> = {};
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

      if (draft?.composition.parameters) {
        parameters = Object.fromEntries(
          Object.entries(draft.composition.parameters).map(([k, p]) => [k, flattenValue(p?.value)])
        );
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
    parameterKeys: Array.from(parameterKeySet).sort(),
    nodes: exportNodes,
  };
  res.status(200).json(payload);
}

interface ImportBody {
  projectId?: string;
  projectMapId: string;
  nodes: NodeUpsert[];
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const body = req.body as ImportBody;
  if (!body?.projectMapId || !Array.isArray(body.nodes)) {
    res.status(400).json({ error: 'Expected { projectMapId, nodes } in request body.' });
    return;
  }
  const projectId = resolveProjectId(body.projectId);

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

  const result = await upsertProjectMapNodes(projectId, body.projectMapId, nodes);
  res.status(200).json(result);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await handleGet(req, res);
    } else if (req.method === 'POST') {
      await handlePost(req, res);
    } else {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: `Method ${req.method} not allowed.` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ error: message });
  }
}
