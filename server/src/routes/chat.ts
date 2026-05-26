import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../db';
import { authenticate, resolveSystem } from '../middleware/auth';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/', authenticate, resolveSystem, async (req: Request, res: Response): Promise<void> => {
  const { messages } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: 'messages are required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const systemId = req.systemId!;

    const systemResult = await pool.query('SELECT name FROM systems WHERE id = $1', [systemId]);
    const systemName = systemResult.rows[0]?.name ?? 'CMDB360';

    const dimsResult = await pool.query(
      'SELECT id, name, subtitle FROM dimensions WHERE system_id = $1 ORDER BY slot',
      [systemId]
    );

    const itemsResult = await pool.query(
      `SELECT ci.code, ci.description, ci.details, d.name as dim_name
       FROM content_items ci
       JOIN dimensions d ON d.id = ci.dimension_id
       WHERE d.system_id = $1
       ORDER BY d.slot, ci.code`,
      [systemId]
    );

    const relsResult = await pool.query(
      `SELECT ci1.code as code1, ci2.code as code2
       FROM relationships r
       JOIN content_items ci1 ON ci1.id = r.item1_id
       JOIN content_items ci2 ON ci2.id = r.item2_id
       JOIN dimensions d ON d.id = ci1.dimension_id
       WHERE d.system_id = $1`,
      [systemId]
    );

    const byDim = new Map<string, string[]>();
    for (const row of itemsResult.rows) {
      const lines = byDim.get(row.dim_name) ?? [];
      const details = row.details ? ` — ${(row.details as string).slice(0, 150)}` : '';
      lines.push(`  - ${row.code}: ${row.description}${details}`);
      byDim.set(row.dim_name, lines);
    }

    const dimensionSection = [...byDim.entries()]
      .map(([dim, lines]) => `### ${dim}\n${lines.join('\n')}`)
      .join('\n\n');

    const dimList = dimsResult.rows
      .map((d: Record<string, unknown>) => `  - ${d.name}${d.subtitle ? ` (${d.subtitle})` : ''}`)
      .join('\n');

    const relSection = relsResult.rows.length > 0
      ? relsResult.rows.map((r: Record<string, unknown>) => `  - ${r.code1} ↔ ${r.code2}`).join('\n')
      : '  None recorded.';

    const systemPrompt = `You are the ${systemName} Chatbot, an intelligent assistant with full knowledge of this organisation's knowledgebase.

## Knowledgebase Overview
Dimensions (categories):
${dimList}

## All Entries by Dimension
${dimensionSection}

## Relationships
${relSection}

Answer questions about any entry, dimension, or relationship in the knowledgebase. Be concise and helpful. If asked about something not in the data, say so clearly.`;

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    res.write(`data: ${JSON.stringify({ error: 'AI service error. Please try again.' })}\n\n`);
    res.end();
  }
});

export default router;
