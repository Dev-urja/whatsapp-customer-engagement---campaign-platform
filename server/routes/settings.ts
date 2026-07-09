import { Router, Response } from 'express';
import { queryOne } from '../db';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { testWhatsAppConnection, WhatsAppApiError } from '../whatsapp/client';
import { generateVerifyToken, getWebhookUrl } from '../whatsapp/settings';

const router = Router();
router.use(requireAuth);

function mapSettings(row: any) {
  return {
    phoneNumberId: row.phone_number_id || '',
    wabaId: row.waba_id || '',
    accessToken: row.access_token || '',
    verifyToken: row.verify_token || '',
    webhookUrl: row.webhook_url || '',
    webhookStatus: row.webhook_status || 'disconnected',
    botEnabled: row.bot_enabled ?? false,
  };
}

// GET /api/settings
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const row = await queryOne('SELECT * FROM system_settings WHERE id = 1');
    if (!row) {
      return res.json({
        ...mapSettings({}),
        webhookUrl: getWebhookUrl(),
      });
    }
    const mapped = mapSettings(row);
    if (!mapped.webhookUrl) mapped.webhookUrl = getWebhookUrl();
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

// PUT /api/settings  (Admin only)
router.put('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { phoneNumberId, wabaId, accessToken, verifyToken, webhookUrl, webhookStatus, botEnabled } = req.body;

  const resolvedVerifyToken = (verifyToken || '').trim() || generateVerifyToken();
  const resolvedWebhookUrl = (webhookUrl || '').trim() || getWebhookUrl();

  try {
    const row = await queryOne(
      `INSERT INTO system_settings (id, phone_number_id, waba_id, access_token, verify_token, webhook_url, webhook_status, bot_enabled)
       VALUES (1,$1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         phone_number_id = EXCLUDED.phone_number_id,
         waba_id         = EXCLUDED.waba_id,
         access_token    = EXCLUDED.access_token,
         verify_token    = EXCLUDED.verify_token,
         webhook_url     = EXCLUDED.webhook_url,
         webhook_status  = EXCLUDED.webhook_status,
         bot_enabled     = EXCLUDED.bot_enabled
       RETURNING *`,
      [
        phoneNumberId,
        wabaId,
        accessToken,
        resolvedVerifyToken,
        resolvedWebhookUrl,
        webhookStatus || 'disconnected',
        botEnabled ?? false,
      ]
    );
    res.json(mapSettings(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

// POST /api/settings/test — verify Meta credentials
router.post('/test', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await testWhatsAppConnection();
    res.json(result);
  } catch (err) {
    if (err instanceof WhatsAppApiError) {
      return res.status(502).json({ message: err.message, details: err.details });
    }
    console.error(err);
    res.status(500).json({ message: 'Connection test failed' });
  }
});

export default router;
