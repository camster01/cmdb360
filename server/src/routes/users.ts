import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool, genId } from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

function rowToUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
  };
}

// All users routes require admin role
router.use(authenticate, requireRole('admin'));

// GET /api/users
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(result.rows.map(rowToUser));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { username, password, role } = req.body as {
    username?: string;
    password?: string;
    role?: string;
  };

  if (!username || !password || !role) {
    res.status(400).json({ error: 'username, password, and role are required' });
    return;
  }

  if (!['admin', 'contributor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'role must be admin, contributor, or viewer' });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const id = genId();
    const result = await pool.query(
      'INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, role, created_at',
      [id, username, passwordHash, role]
    );
    res.status(201).json(rowToUser(result.rows[0]));
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { username, password, role } = req.body as {
    username?: string;
    password?: string;
    role?: string;
  };

  try {
    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const current = existing.rows[0];
    const newUsername = username ?? current.username;
    const newRole = role ?? current.role;
    let newPasswordHash = current.password_hash;

    if (role && !['admin', 'contributor', 'viewer'].includes(role)) {
      res.status(400).json({ error: 'role must be admin, contributor, or viewer' });
      return;
    }

    if (password) {
      newPasswordHash = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      `UPDATE users SET username = $1, password_hash = $2, role = $3 WHERE id = $4
       RETURNING id, username, role, created_at`,
      [newUsername, newPasswordHash, newRole, id]
    );
    res.json(rowToUser(result.rows[0]));
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Prevent deleting yourself
  if (req.user && req.user.id === id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
