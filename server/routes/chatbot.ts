import { Router, Response } from 'express';
import { queryOne } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function mapFlow(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    created_by: row.created_by,
    created_at: row.created_at,
    isActive: row.is_active,
    nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
    edges: typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges,
  };
}

// GET /api/chatbot/flow
router.get('/flow', async (_req: AuthRequest, res: Response) => {
  try {
    const row = await queryOne('SELECT * FROM chatbot_flows WHERE is_active = true LIMIT 1');
    if (!row) return res.status(404).json({ message: 'No active chatbot flow found' });
    res.json(mapFlow(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch chatbot flow' });
  }
});

// PUT /api/chatbot/flow
router.put('/flow', async (req: AuthRequest, res: Response) => {
  const { id, name, description, isActive, nodes, edges } = req.body;
  const flowId = id || 'flow-1';

  try {
    const row = await queryOne(
      `INSERT INTO chatbot_flows (id, name, description, created_by, is_active, nodes, edges)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         name        = EXCLUDED.name,
         description = EXCLUDED.description,
         is_active   = EXCLUDED.is_active,
         nodes       = EXCLUDED.nodes,
         edges       = EXCLUDED.edges
       RETURNING *`,
      [flowId, name || 'Default Flow', description || '', req.userId, isActive ?? true, JSON.stringify(nodes || []), JSON.stringify(edges || [])]
    );
    res.json(mapFlow(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save chatbot flow' });
  }
});

export default router;
