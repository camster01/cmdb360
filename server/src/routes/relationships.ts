import { Router, Request, Response } from 'express';
import { pool, genId } from '../db';
import { authenticate, resolveSystem, requireRole } from '../middleware/auth';

const router = Router();

function rowToRelationship(row: Record<string, unknown>) {
  return { id: row.id, item1Id: row.item1_id, item2Id: row.item2_id, createdAt: row.created_at };
}

router.get('/', authenticate, resolveSystem, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT r.* FROM relationships r
       JOIN content_items ci ON ci.id = r.item1_id
       JOIN dimensions d ON d.id = ci.dimension_id
       WHERE d.system_id = $1
       ORDER BY r.created_at ASC`,
      [req.systemId]
    );
    res.json(result.rows.map(rowToRelationship));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, resolveSystem, requireRole('contributor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { item1Id, item2Id } = req.body as { item1Id?: string; item2Id?: string };
    if (!item1Id || !item2Id) {
      res.status(400).json({ error: 'item1Id and item2Id are required' });
      return;
    }
    if (item1Id === item2Id) {
      res.status(400).json({ error: 'Cannot relate an item to itself' });
      return;
    }
    try {
      const existing = await pool.query(
        `SELECT id FROM relationships
         WHERE (item1_id=$1 AND item2_id=$2) OR (item1_id=$2 AND item2_id=$1)`,
        [item1Id, item2Id]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Relationship already exists' });
        return;
      }
      const id = genId();
      const result = await pool.query(
        'INSERT INTO relationships (id, item1_id, item2_id) VALUES ($1,$2,$3) RETURNING *',
        [id, item1Id, item2Id]
      );
      res.status(201).json(rowToRelationship(result.rows[0]));
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
      const result = await pool.query('DELETE FROM relationships WHERE id=$1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Relationship not found' });
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
