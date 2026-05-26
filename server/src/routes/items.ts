import { Router, Request, Response } from 'express';
import { pool, genId } from '../db';
import { authenticate, resolveSystem, requireRole } from '../middleware/auth';

const router = Router();

function rowToItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    dimensionId: row.dimension_id,
    code: row.code,
    description: row.description,
    details: row.details ?? undefined,
    urls: Array.isArray(row.urls) ? row.urls : (row.urls ? JSON.parse(row.urls as string) : []),
    org_node_id: row.org_node_id ?? null,
    order_number: row.order_number ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', authenticate, resolveSystem, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT ci.* FROM content_items ci
       JOIN dimensions d ON d.id = ci.dimension_id
       WHERE d.system_id = $1
       ORDER BY ci.created_at ASC`,
      [req.systemId]
    );
    res.json(result.rows.map(rowToItem));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, resolveSystem, requireRole('contributor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { dimensionId, code, description, details, urls, org_node_id, order_number } = req.body as {
      dimensionId?: string; code?: string; description?: string;
      details?: string; urls?: Array<{ label: string; url: string }>;
      org_node_id?: string | null; order_number?: string | null;
    };
    if (!dimensionId || !code) {
      res.status(400).json({ error: 'dimensionId and code are required' });
      return;
    }
    try {
      const id = genId();
      const result = await pool.query(
        `INSERT INTO content_items (id, dimension_id, code, description, details, urls, org_node_id, order_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [id, dimensionId, code, description ?? null, details ?? null, JSON.stringify(urls ?? []),
         org_node_id ?? null, order_number?.trim() || null]
      );
      res.status(201).json(rowToItem(result.rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.put('/:id', authenticate, resolveSystem, requireRole('contributor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { dimensionId, code, description, details, urls, org_node_id, order_number } = req.body as {
      dimensionId?: string; code?: string; description?: string;
      details?: string; urls?: Array<{ label: string; url: string }>; org_node_id?: string | null;
      order_number?: string | null;
    };
    try {
      const existing = await pool.query('SELECT * FROM content_items WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }
      const cur = existing.rows[0];
      const result = await pool.query(
        `UPDATE content_items
         SET dimension_id=$1, code=$2, description=$3, details=$4, urls=$5, org_node_id=$6, order_number=$7, updated_at=NOW()
         WHERE id=$8 RETURNING *`,
        [
          dimensionId ?? cur.dimension_id,
          code ?? cur.code,
          description !== undefined ? description : cur.description,
          details !== undefined ? details : cur.details,
          urls !== undefined ? JSON.stringify(urls) : JSON.stringify(cur.urls ?? []),
          org_node_id !== undefined ? (org_node_id || null) : cur.org_node_id,
          order_number !== undefined ? (order_number?.trim() || null) : cur.order_number,
          id,
        ]
      );
      res.json(rowToItem(result.rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/:id', authenticate, resolveSystem, requireRole('contributor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM content_items WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
