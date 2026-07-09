import { Router, Response } from 'express';
import { query, queryOne, exec } from '../db';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { syncTemplatesFromMeta, WhatsAppApiError } from '../whatsapp/client';

const router = Router();
router.use(requireAuth);

function mapTemplate(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    language: row.language,
    status: row.status,
    bodyText: row.body_text,
    variables: row.variables || [],
  };
}

// GET /api/templates
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query('SELECT * FROM whatsapp_templates ORDER BY name');
    res.json(rows.map(mapTemplate));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

// POST /api/templates
router.post('/', async (req: AuthRequest, res: Response) => {
  const { id, name, category, language, status, bodyText, variables } = req.body;
  const newId = id || `temp-${Date.now()}`;
  try {
    const row = await queryOne(
      `INSERT INTO whatsapp_templates (id, name, category, language, status, body_text, variables)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [newId, name, category || 'MARKETING', language || 'en_US', status || 'APPROVED', bodyText, variables || []]
    );
    res.status(201).json(mapTemplate(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create template' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await exec('DELETE FROM whatsapp_templates WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

// POST /api/templates/sync — pull approved templates from Meta
router.post('/sync', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const remote = await syncTemplatesFromMeta();
    let synced = 0;

    for (const tpl of remote) {
      const bodyComponent = tpl.components?.find((c) => c.type === 'BODY');
      const bodyText = bodyComponent?.text || '';
      const id = `meta-${tpl.name}-${tpl.language}`.replace(/[^a-zA-Z0-9_-]/g, '_');

      await queryOne(
        `INSERT INTO whatsapp_templates (id, name, category, language, status, body_text, variables)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           category = EXCLUDED.category,
           language = EXCLUDED.language,
           status = EXCLUDED.status,
           body_text = EXCLUDED.body_text`,
        [
          id,
          tpl.name,
          tpl.category || 'MARKETING',
          tpl.language || 'en_US',
          tpl.status || 'PENDING',
          bodyText,
          [],
        ]
      );
      synced += 1;
    }

    const rows = await query('SELECT * FROM whatsapp_templates ORDER BY name');
    res.json({ synced, templates: rows.map(mapTemplate) });
  } catch (err) {
    if (err instanceof WhatsAppApiError) {
      return res.status(502).json({ message: err.message, details: err.details });
    }
    console.error(err);
    res.status(500).json({ message: 'Failed to sync templates from Meta' });
  }
});

export default router;
