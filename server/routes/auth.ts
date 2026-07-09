import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, exec, mapDbError } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await queryOne<any>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive. Contact your admin.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last_login
    await exec('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );

    const { password_hash, ...safeUser } = user;
    return res.json({ token, user: mapUser(safeUser) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: mapDbError(err) });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await queryOne<any>(
      'SELECT id, name, email, role, status, created_at, last_login FROM users WHERE id = $1',
      [req.userId]
    );

    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(mapUser(user));
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: mapDbError(err) });
  }
});

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

export default router;
