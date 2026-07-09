import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, exec } from '../db';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function mapUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    lastLogin: row.last_login,
  };
}

// GET /api/users
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query('SELECT id, name, email, role, status, created_at, last_login FROM users ORDER BY created_at');
    res.json(rows.map(mapUser));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// POST /api/users  (Admin only)
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id, name, email, role, status, password } = req.body;
  const newId = id || `u-${Date.now()}`;
  const rawPassword = password || 'Urja@2026!';

  try {
    const hash = await bcrypt.hash(rawPassword, 10);
    const row = await queryOne(
      `INSERT INTO users (id, name, email, password_hash, role, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, status, created_at, last_login`,
      [newId, name, email, hash, role || 'Sales', status || 'active']
    );
    res.status(201).json(mapUser(row));
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

// PUT /api/users/:id  (Admin only)
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, role, status } = req.body;

  try {
    const existing = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'User not found' });

    const row = await queryOne(
      `UPDATE users SET
        name = COALESCE($1, name),
        role = COALESCE($2, role),
        status = COALESCE($3, status)
       WHERE id = $4 RETURNING id, name, email, role, status, created_at, last_login`,
      [name ?? null, role ?? null, status ?? null, req.params.id]
    );
    res.json(mapUser(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// DELETE /api/users/:id  (Admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }
  try {
    await exec('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

export default router;
