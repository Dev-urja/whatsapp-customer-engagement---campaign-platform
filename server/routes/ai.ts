import { Router, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

let ai: GoogleGenAI | null = null;

function getAI() {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

/**
 * POST /api/ai/generate-reply
 * Body: { conversationHistory, customerName, chatbotContext }
 * Returns: { reply: string }
 */
router.post('/generate-reply', async (req: AuthRequest, res: Response) => {
  const { conversationHistory, customerName, chatbotContext } = req.body;

  const client = getAI();
  if (!client) {
    return res.status(503).json({
      message: 'Gemini AI is not configured. Set GEMINI_API_KEY in your .env file.',
      fallback: true,
    });
  }

  const history = Array.isArray(conversationHistory)
    ? conversationHistory.slice(-6).map((m: any) => `${m.sender === 'customer' ? customerName || 'Customer' : 'Agent'}: ${m.content}`).join('\n')
    : '';

  const flowContext = chatbotContext
    ? `\nChatbot flow context: ${chatbotContext}`
    : '';

  const prompt = `You are a helpful WhatsApp business assistant for Urja Group, an industrial energy and solar battery company based in India.
Respond to the customer in a professional, warm, and concise manner (2-3 sentences max).
Use simple language appropriate for a WhatsApp message. Do not use markdown or bullet points.
${flowContext}

Recent conversation:
${history}

Generate a helpful bot reply to the customer's last message:`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const reply = response.text?.trim() || 'Thank you for reaching out! A team member will be with you shortly.';
    res.json({ reply });
  } catch (err: any) {
    console.error('Gemini error:', err);
    res.status(500).json({
      message: 'AI generation failed',
      fallback: true,
      reply: '🤖 Thank you for your message! Our team will get back to you shortly.',
    });
  }
});

export default router;
