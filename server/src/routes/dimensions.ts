import { Router, Request, Response } from 'express';
import { pool, genId } from '../db';
import { authenticate, resolveSystem, requireRole } from '../middleware/auth';

const router = Router();

function rowToDimension(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? undefined,
    slot: row.slot,
    visible: row.visible !== false,
    createdAt: row.created_at,
  };
}

router.get('/', authenticate, resolveSystem, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT * FROM dimensions WHERE system_id = $1 ORDER BY slot ASC',
      [req.systemId]
    );
    res.json(result.rows.map(rowToDimension));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, resolveSystem, requireRole('contributor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { name, subtitle, slot } = req.body as { name?: string; subtitle?: string; slot?: number };
    if (!name || slot === undefined) {
      res.status(400).json({ error: 'name and slot are required' });
      return;
    }
    try {
      const id = genId();
      const result = await pool.query(
        'INSERT INTO dimensions (id, system_id, name, subtitle, slot) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [id, req.systemId, name, subtitle ?? null, slot]
      );
      res.status(201).json(rowToDimension(result.rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.put('/:id', authenticate, resolveSystem, requireRole('contributor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, subtitle, slot, visible } = req.body as {
      name?: string; subtitle?: string; slot?: number; visible?: boolean;
    };
    try {
      const existing = await pool.query(
        'SELECT * FROM dimensions WHERE id = $1 AND system_id = $2', [id, req.systemId]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Dimension not found' });
        return;
      }
      const cur = existing.rows[0];
      const result = await pool.query(
        'UPDATE dimensions SET name=$1, subtitle=$2, slot=$3, visible=$4 WHERE id=$5 RETURNING *',
        [
          name ?? cur.name,
          subtitle !== undefined ? (subtitle || null) : cur.subtitle,
          slot ?? cur.slot,
          visible !== undefined ? visible : cur.visible,
          id,
        ]
      );
      res.json(rowToDimension(result.rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/:id', authenticate, resolveSystem, requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'DELETE FROM dimensions WHERE id = $1 AND system_id = $2 RETURNING id',
        [id, req.systemId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Dimension not found' });
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
