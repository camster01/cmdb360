import { Router, Request, Response } from 'express';
import { pool, genId } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

function rowToSystem(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.created_at,
  };
}

// GET /api/systems — admin sees all; others see only their systems
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user!.role === 'admin') {
      const result = await pool.query('SELECT * FROM systems ORDER BY created_at ASC');
      res.json(result.rows.map(rowToSystem));
    } else {
      const result = await pool.query(
        `SELECT s.* FROM systems s
         JOIN user_system_roles usr ON usr.system_id = s.id
         WHERE usr.user_id = $1
         ORDER BY s.created_at ASC`,
        [req.user!.id]
      );
      res.json(result.rows.map(rowToSystem));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/systems — admin only
router.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    const id = genId();
    const result = await pool.query(
      'INSERT INTO systems (id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [id, name.trim(), description?.trim() ?? null]
    );

    // Seed 8 default dimensions for the new system
    for (let slot = 0; slot < 8; slot++) {
      await pool.query(
        'INSERT INTO dimensions (id, system_id, name, slot, visible) VALUES ($1, $2, $3, $4, TRUE)',
        [genId(), id, `Dimension ${slot + 1}`, slot]
      );
    }

    res.status(201).json(rowToSystem(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/systems/:id — admin only
router.put('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const { id } = req.params;
  const { name, description } = req.body as { name?: string; description?: string };
  try {
    const existing = await pool.query('SELECT * FROM systems WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'System not found' });
      return;
    }
    const cur = existing.rows[0];
    const result = await pool.query(
      'UPDATE systems SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name?.trim() ?? cur.name, description !== undefined ? (description.trim() || null) : cur.description, id]
    );
    res.json(rowToSystem(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/systems/:id — admin only
router.delete('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM systems WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'System not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/systems/:id/members — admin only
router.get('/:id/members', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.role as global_role, usr.role as system_role
       FROM users u
       LEFT JOIN user_system_roles usr ON usr.user_id = u.id AND usr.system_id = $1
       ORDER BY u.username ASC`,
      [id]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      username: r.username,
      globalRole: r.global_role,
      systemRole: r.global_role === 'admin' ? 'admin' : (r.system_role ?? null),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/systems/:id/members/:userId — set role (admin only)
router.put('/:id/members/:userId', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const { id, userId } = req.params;
  const { role } = req.body as { role?: string };
  if (!role || !['contributor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'role must be contributor or viewer' });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO user_system_roles (user_id, system_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, system_id) DO UPDATE SET role = $3`,
      [userId, id, role]
    );
    res.json({ userId, systemId: id, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/systems/:id/members/:userId — remove access (admin only)
router.delete('/:id/members/:userId', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const { id, userId } = req.params;
  try {
    await pool.query('DELETE FROM user_system_roles WHERE user_id = $1 AND system_id = $2', [userId, id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
