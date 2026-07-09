import { Router, Response } from 'express';
import { query, queryOne, exec } from '../db';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function mapRole(row: any) {
  let permissions = row.permissions;
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch { permissions = []; }
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    permissions: permissions || [],
    isSystem: Boolean(row.is_system),
    created_at: row.created_at,
  };
}

// GET /api/roles
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query('SELECT * FROM roles ORDER BY is_system DESC, name ASC');
    res.json(rows.map(mapRole));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch roles' });
  }
});

// POST /api/roles (Admin only)
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id, name, description, permissions } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Role name is required' });

  const newId = id || `role-${Date.now()}`;
  const perms = Array.isArray(permissions) ? permissions : [];

  try {
    const existing = await queryOne('SELECT id FROM roles WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (existing) return res.status(409).json({ message: 'A role with this name already exists' });

    const row = await queryOne(
      `INSERT INTO roles (id, name, description, permissions, is_system)
       VALUES ($1,$2,$3,$4,0) RETURNING *`,
      [newId, name.trim(), description || '', JSON.stringify(perms)]
    );
    res.status(201).json(mapRole(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create role' });
  }
});

// PUT /api/roles/:id (Admin only)
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, permissions } = req.body;

  try {
    const existing = await queryOne('SELECT * FROM roles WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'Role not found' });

    const perms = Array.isArray(permissions) ? permissions : JSON.parse(existing.permissions || '[]');
    const updatedName = name?.trim() || existing.name;

    if (existing.is_system && updatedName !== existing.name) {
      return res.status(400).json({ message: 'System roles cannot be renamed' });
    }

    const row = await queryOne(
      `UPDATE roles SET
        name = $1,
        description = COALESCE($2, description),
        permissions = $3
       WHERE id = $4 RETURNING *`,
      [updatedName, description ?? existing.description, JSON.stringify(perms), req.params.id]
    );
    res.json(mapRole(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update role' });
  }
});

// DELETE /api/roles/:id (Admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await queryOne('SELECT * FROM roles WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'Role not found' });
    if (existing.is_system) return res.status(400).json({ message: 'System roles cannot be deleted' });

    const inUse = await queryOne('SELECT id FROM users WHERE role = $1 LIMIT 1', [existing.name]);
    if (inUse) return res.status(400).json({ message: 'Cannot delete a role that is assigned to users' });

    await exec('DELETE FROM roles WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete role' });
  }
});

export default router;
