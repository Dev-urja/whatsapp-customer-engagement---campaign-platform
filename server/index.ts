import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDb, checkDb } from './db';
import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import campaignRoutes from './routes/campaigns';
import conversationRoutes from './routes/conversations';
import templateRoutes from './routes/templates';
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import chatbotRoutes from './routes/chatbot';
import aiRoutes from './routes/ai';
import rolesRoutes from './routes/roles';
import webhookRoutes from './routes/webhook';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === 'production';

const corsOrigins = [process.env.APP_URL, process.env.PUBLIC_URL].filter(Boolean) as string[];
app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (_req, res) => {
  const db = await checkDb();
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? 'ok' : 'error',
    db: db.mode,
    message: db.message,
    timestamp: new Date().toISOString(),
  });
});

// Meta webhook — must be public (no JWT)
app.use('/api/webhook', webhookRoutes);

app.use('/api/auth',          authRoutes);
app.use('/api/customers',     customerRoutes);
app.use('/api/campaigns',     campaignRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/templates',     templateRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/chatbot',       chatbotRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/roles',         rolesRoutes);

if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use('/api/*', (_req, res) => res.status(404).json({ message: 'API route not found' }));

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`\n🚀 Urja WhatsApp API server running on http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      if (isProduction) {
        console.log(`   App:    http://localhost:${PORT}\n`);
      } else {
        console.log(`   Webhook: ${process.env.PUBLIC_URL || process.env.APP_URL || `http://localhost:${PORT}`}/api/webhook\n`);
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
