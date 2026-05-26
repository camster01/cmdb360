import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/settings — public
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT key, value FROM app_settings');
    const settings: Record<string, string> = {};
    for (const row of result.rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/:key — admin only
router.put('/:key', authenticate, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body as { value: string };
  if (typeof value !== 'string') { res.status(400).json({ error: 'value required' }); return; }
  try {
    await pool.query(
      'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
    res.json({ key, value });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
