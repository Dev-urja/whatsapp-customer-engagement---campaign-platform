import { Router, Request, Response } from 'express';
import { loadWhatsAppSettings } from '../whatsapp/settings';
import { processWhatsAppWebhook } from '../whatsapp/inbound';
import { exec } from '../db';

const router = Router();

/** Meta webhook verification (GET) */
router.get('/', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const settings = await loadWhatsAppSettings();
  if (mode === 'subscribe' && token && token === settings?.verifyToken) {
    await exec(
      `UPDATE system_settings SET webhook_status = 'connected' WHERE id = 1`
    ).catch(() => {});
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Verification failed');
});

/** Incoming messages + delivery status (POST) */
router.post('/', async (req: Request, res: Response) => {
  try {
    await processWhatsAppWebhook(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.sendStatus(200);
  }
});

export default router;
