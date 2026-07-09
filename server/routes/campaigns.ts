import { Router, Response } from 'express';
import { query, queryOne, exec } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendTemplateMessage, WhatsAppApiError } from '../whatsapp/client';

const router = Router();
router.use(requireAuth);

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapCampaign(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    templateId: row.template_id,
    customText: row.custom_text || undefined,
    mediaUrl: row.media_url || undefined,
    scheduledTime: row.scheduled_time || undefined,
    status: row.status,
    createdBy: row.created_by,
    created_at: row.created_at,
    audienceCount: row.audience_count,
    sentCount: row.sent_count,
    deliveredCount: row.delivered_count,
    readCount: row.read_count,
    failedCount: row.failed_count,
    replyCount: row.reply_count,
  };
}

// GET /api/campaigns
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query('SELECT * FROM campaigns ORDER BY created_at DESC');
    res.json(rows.map(mapCampaign));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch campaigns' });
  }
});

// POST /api/campaigns
router.post('/', async (req: AuthRequest, res: Response) => {
  const { id, name, description, templateId, customText, mediaUrl, scheduledTime, status, audienceCount } = req.body;
  const newId = id || `camp-${Date.now()}`;
  try {
    const row = await queryOne(
      `INSERT INTO campaigns (id, name, description, template_id, custom_text, media_url, scheduled_time, status, created_by, audience_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [newId, name, description || null, templateId || null, customText || null, mediaUrl || null, scheduledTime || null, status || 'Draft', req.userId, audienceCount || 0]
    );
    res.status(201).json(mapCampaign(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create campaign' });
  }
});

// PUT /api/campaigns/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, templateId, customText, mediaUrl, scheduledTime, status, audienceCount, sentCount, deliveredCount, readCount, failedCount, replyCount } = req.body;
  try {
    const row = await queryOne(
      `UPDATE campaigns SET
        name             = COALESCE($1, name),
        description      = COALESCE($2, description),
        template_id      = COALESCE($3, template_id),
        custom_text      = COALESCE($4, custom_text),
        media_url        = COALESCE($5, media_url),
        scheduled_time   = COALESCE($6, scheduled_time),
        status           = COALESCE($7, status),
        audience_count   = COALESCE($8, audience_count),
        sent_count       = COALESCE($9, sent_count),
        delivered_count  = COALESCE($10, delivered_count),
        read_count       = COALESCE($11, read_count),
        failed_count     = COALESCE($12, failed_count),
        reply_count      = COALESCE($13, reply_count)
       WHERE id = $14 RETURNING *`,
      [name, description, templateId, customText, mediaUrl, scheduledTime, status, audienceCount, sentCount, deliveredCount, readCount, failedCount, replyCount, id]
    );
    if (!row) return res.status(404).json({ message: 'Campaign not found' });
    res.json(mapCampaign(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update campaign' });
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await exec('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete campaign' });
  }
});

// POST /api/campaigns/:id/send — send approved template to audience
router.post('/:id/send', async (req: AuthRequest, res: Response) => {
  const { audienceTags = [], templateVariables = {} } = req.body as {
    audienceTags?: string[];
    templateVariables?: Record<string, string>;
  };

  try {
    const campaign = await queryOne<any>('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (!campaign.template_id) {
      return res.status(400).json({ message: 'Campaign has no template selected' });
    }

    const template = await queryOne<any>(
      'SELECT * FROM whatsapp_templates WHERE id = $1',
      [campaign.template_id]
    );
    if (!template) return res.status(400).json({ message: 'Template not found' });

    let customers = await query<any>(
      'SELECT * FROM customers WHERE opt_in_status = true'
    );
    if (audienceTags.length > 0) {
      customers = customers.filter((c) => {
        const tags = parseStringArray(c.tags);
        return tags.some((t) => audienceTags.includes(t));
      });
    }

    if (customers.length === 0) {
      return res.status(400).json({ message: 'No opted-in customers match this audience.' });
    }

    await exec(
      `UPDATE campaigns SET status = 'Sending' WHERE id = $1`,
      [campaign.id]
    );

    let sent = 0;
    let failed = 0;

    const bodyParams = parseStringArray(template.variables).map((key: string) => ({
      type: 'text' as const,
      text: templateVariables[key] || `[${key}]`,
    }));

    const components = bodyParams.length
      ? [{ type: 'body' as const, parameters: bodyParams }]
      : undefined;

    for (const customer of customers) {
      try {
        await sendTemplateMessage(
          customer.phone,
          template.name,
          template.language || 'en_US',
          components
        );
        sent += 1;
        await new Promise((r) => setTimeout(r, 120));
      } catch (err) {
        failed += 1;
        console.error(`Campaign send failed for ${customer.phone}:`, err);
      }
    }

    const row = await queryOne(
      `UPDATE campaigns SET
        status = 'Sent',
        audience_count = $1,
        sent_count = $2,
        failed_count = $3,
        delivered_count = 0,
        read_count = 0,
        reply_count = 0
       WHERE id = $4 RETURNING *`,
      [customers.length, sent, failed, campaign.id]
    );

    res.json({
      campaign: mapCampaign(row),
      sent,
      failed,
      total: customers.length,
    });
  } catch (err) {
    if (err instanceof WhatsAppApiError) {
      return res.status(502).json({ message: err.message, details: err.details });
    }
    console.error(err);
    res.status(500).json({ message: 'Failed to send campaign' });
  }
});

export default router;
