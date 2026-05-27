import { Router, Request, Response } from 'express';
import { pool, genId } from '../db';
import { authenticate, resolveSystem, requireRole } from '../middleware/auth';

const router = Router();

function rowToField(row: Record<string, unknown>) {
  return {
    id: row.id,
    dimensionId: row.dimension_id,
    fieldName: row.field_name,
    fieldType: row.field_type,
    sortOrder: row.sort_order,
  };
}

// GET /fields?dimensionId=xxx — all field definitions for a dimension
router.get('/', authenticate, resolveSystem, async (req: Request, res: Response): Promise<void> => {
  const { dimensionId } = req.query as { dimensionId?: string };
  if (!dimensionId) {
    res.status(400).json({ error: 'dimensionId query param required' });
    return;
  }
  try {
    const dimCheck = await pool.query(
      'SELECT id FROM dimensions WHERE id = $1 AND system_id = $2',
      [dimensionId, req.systemId]
    );
    if (dimCheck.rows.length === 0) {
      res.status(404).json({ error: 'Dimension not found' });
      return;
    }
    const result = await pool.query(
      'SELECT * FROM dimension_fields WHERE dimension_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [dimensionId]
    );
    res.json(result.rows.map(rowToField));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /fields — create a field definition (admin only)
router.post('/', authenticate, resolveSystem, requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { dimensionId, fieldName, fieldType, sortOrder } = req.body as {
      dimensionId?: string; fieldName?: string; fieldType?: string; sortOrder?: number;
    };
    if (!dimensionId || !fieldName?.trim()) {
      res.status(400).json({ error: 'dimensionId and fieldName are required' });
      return;
    }
    try {
      const dimCheck = await pool.query(
        'SELECT id FROM dimensions WHERE id = $1 AND system_id = $2',
        [dimensionId, req.systemId]
      );
      if (dimCheck.rows.length === 0) {
        res.status(404).json({ error: 'Dimension not found' });
        return;
      }
      const id = genId();
      const result = await pool.query(
        `INSERT INTO dimension_fields (id, dimension_id, field_name, field_type, sort_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, dimensionId, fieldName.trim(), fieldType ?? 'text', sortOrder ?? 0]
      );
      res.status(201).json(rowToField(result.rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /fields/:id — update a field definition (admin only)
router.put('/:id', authenticate, resolveSystem, requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { fieldName, fieldType, sortOrder } = req.body as {
      fieldName?: string; fieldType?: string; sortOrder?: number;
    };
    try {
      const existing = await pool.query(
        `SELECT df.* FROM dimension_fields df
         JOIN dimensions d ON d.id = df.dimension_id
         WHERE df.id = $1 AND d.system_id = $2`,
        [id, req.systemId]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Field not found' });
        return;
      }
      const cur = existing.rows[0];
      const result = await pool.query(
        `UPDATE dimension_fields SET field_name=$1, field_type=$2, sort_order=$3 WHERE id=$4 RETURNING *`,
        [
          fieldName?.trim() ?? cur.field_name,
          fieldType ?? cur.field_type,
          sortOrder !== undefined ? sortOrder : cur.sort_order,
          id,
        ]
      );
      res.json(rowToField(result.rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /fields/:id — remove a field definition (admin only)
router.delete('/:id', authenticate, resolveSystem, requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM dimension_fields
         WHERE id = $1
         AND dimension_id IN (SELECT id FROM dimensions WHERE system_id = $2)
         RETURNING id`,
        [id, req.systemId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Field not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /fields/values/:itemId — get all field values for an item
router.get('/values/:itemId', authenticate, resolveSystem, async (req: Request, res: Response): Promise<void> => {
  const { itemId } = req.params;
  try {
    const itemCheck = await pool.query(
      `SELECT ci.id FROM content_items ci
       JOIN dimensions d ON d.id = ci.dimension_id
       WHERE ci.id = $1 AND d.system_id = $2`,
      [itemId, req.systemId]
    );
    if (itemCheck.rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    const result = await pool.query(
      'SELECT field_id, value FROM item_field_values WHERE item_id = $1',
      [itemId]
    );
    const values: Record<string, string> = {};
    for (const row of result.rows) {
      values[row.field_id] = row.value;
    }
    res.json(values);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /fields/values/:itemId — upsert field values for an item (batch)
router.put('/values/:itemId', authenticate, resolveSystem, requireRole('contributor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { itemId } = req.params;
    const { values } = req.body as { values: Record<string, string> };
    if (!values || typeof values !== 'object') {
      res.status(400).json({ error: 'values object required' });
      return;
    }
    try {
      const itemCheck = await pool.query(
        `SELECT ci.id FROM content_items ci
         JOIN dimensions d ON d.id = ci.dimension_id
         WHERE ci.id = $1 AND d.system_id = $2`,
        [itemId, req.systemId]
      );
      if (itemCheck.rows.length === 0) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }
      for (const [fieldId, value] of Object.entries(values)) {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (!trimmed) {
          await pool.query(
            'DELETE FROM item_field_values WHERE item_id = $1 AND field_id = $2',
            [itemId, fieldId]
          );
        } else {
          await pool.query(
            `INSERT INTO item_field_values (item_id, field_id, value) VALUES ($1, $2, $3)
             ON CONFLICT (item_id, field_id) DO UPDATE SET value = EXCLUDED.value`,
            [itemId, fieldId, trimmed]
          );
        }
      }
      // Return updated values
      const result = await pool.query(
        'SELECT field_id, value FROM item_field_values WHERE item_id = $1',
        [itemId]
      );
      const updated: Record<string, string> = {};
      for (const row of result.rows) {
        updated[row.field_id] = row.value;
      }
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
