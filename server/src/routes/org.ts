import { Router, Request, Response } from 'express';
import { pool, genId } from '../db';
import { authenticate, resolveSystem, requireRole } from '../middleware/auth';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FlatNode {
  id: string; parent_id: string | null; name: string;
  description: string | null; sort_order: number; children_label: string | null;
}
interface TreeNode extends FlatNode {
  children: TreeNode[];
}

function buildTree(flat: FlatNode[], parentId: string | null = null): TreeNode[] {
  return flat
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(n => ({ ...n, children: buildTree(flat, n.id) }));
}

async function getLabels(systemId: string): Promise<string[]> {
  const r = await pool.query(
    'SELECT level_labels FROM org_config WHERE system_id = $1', [systemId]
  );
  return (r.rows[0]?.level_labels as string[]) ?? ['Site', 'Building', 'Area'];
}

// ── GET /api/org — full tree + labels ─────────────────────────────────────────
router.get('/', authenticate, resolveSystem, async (req: Request, res: Response): Promise<void> => {
  try {
    const [nodesResult, labels] = await Promise.all([
      pool.query(
        'SELECT id, parent_id, name, description, sort_order, children_label FROM org_nodes WHERE system_id=$1',
        [req.systemId]
      ),
      getLabels(req.systemId!),
    ]);
    res.json({ labels, tree: buildTree(nodesResult.rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/org/labels — save level label array ───────────────────────────────
router.put('/labels', authenticate, resolveSystem, requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { labels } = req.body as { labels?: string[] };
    if (!Array.isArray(labels) || labels.some(l => typeof l !== 'string')) {
      res.status(400).json({ error: 'labels must be a string array' }); return;
    }
    try {
      await pool.query(
        `INSERT INTO org_config (system_id, level_labels) VALUES ($1, $2)
         ON CONFLICT (system_id) DO UPDATE SET level_labels = $2`,
        [req.systemId, JSON.stringify(labels)]
      );
      res.json({ labels });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── POST /api/org/nodes — create a node ───────────────────────────────────────
router.post('/nodes', authenticate, resolveSystem, requireRole('contributor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { parent_id, name, description, children_label } = req.body as {
      parent_id?: string | null; name?: string; description?: string; children_label?: string | null;
    };
    if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return; }

    // If parent supplied, verify it belongs to this system
    if (parent_id) {
      const p = await pool.query(
        'SELECT id FROM org_nodes WHERE id=$1 AND system_id=$2', [parent_id, req.systemId]
      );
      if (p.rows.length === 0) { res.status(404).json({ error: 'Parent node not found' }); return; }
    }

    try {
      const id = genId();
      const result = await pool.query(
        `INSERT INTO org_nodes (id, system_id, parent_id, name, description, children_label)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, req.systemId, parent_id ?? null, name.trim(), description?.trim() ?? null,
         children_label?.trim() || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── PUT /api/org/nodes/:id — update name / description ────────────────────────
router.put('/nodes/:id', authenticate, resolveSystem, requireRole('contributor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, description, children_label } = req.body as {
      name?: string; description?: string; children_label?: string | null;
    };
    try {
      const existing = await pool.query(
        'SELECT * FROM org_nodes WHERE id=$1 AND system_id=$2', [id, req.systemId]
      );
      if (existing.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
      const cur = existing.rows[0];
      // children_label: null means "clear override", undefined means "don't change"
      const newChildrenLabel = children_label === undefined
        ? cur.children_label
        : (children_label?.trim() || null);
      const result = await pool.query(
        'UPDATE org_nodes SET name=$1, description=$2, children_label=$3 WHERE id=$4 RETURNING *',
        [name?.trim() ?? cur.name, description !== undefined ? (description.trim() || null) : cur.description,
         newChildrenLabel, id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── DELETE /api/org/nodes/:id — cascade deletes all children ──────────────────
router.delete('/nodes/:id', authenticate, resolveSystem, requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'DELETE FROM org_nodes WHERE id=$1 AND system_id=$2 RETURNING id', [id, req.systemId]
      );
      if (result.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
