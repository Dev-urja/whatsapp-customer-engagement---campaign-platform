import { Router, Response } from 'express';
import { query, queryOne, deleteByIds } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function mapCustomer(row: any) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    tags: row.tags || [],
    assignedSalesUserId: row.assigned_sales_user_id,
    created_at: row.created_at,
    optInStatus: row.opt_in_status,
    notes: row.notes || '',
  };
}

// GET /api/customers
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(rows.map(mapCustomer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
});

// POST /api/customers
router.post('/', async (req: AuthRequest, res: Response) => {
  const { id, name, phone, email, tags, assignedSalesUserId, optInStatus, notes } = req.body;
  const newId = id || `c-${Date.now()}`;
  try {
    const row = await queryOne(
      `INSERT INTO customers (id, name, phone, email, tags, assigned_sales_user_id, opt_in_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [newId, name, phone, email || null, tags || [], assignedSalesUserId || null, optInStatus ?? true, notes || null]
    );
    res.status(201).json(mapCustomer(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create customer' });
  }
});

// POST /api/customers/import
router.post('/import', async (req: AuthRequest, res: Response) => {
  const { customers } = req.body;
  if (!Array.isArray(customers) || customers.length === 0) {
    return res.status(400).json({ message: 'customers array is required' });
  }

  const inserted: any[] = [];
  try {
    for (const c of customers) {
      const newId = c.id || `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const row = await queryOne(
        `INSERT INTO customers (id, name, phone, email, tags, assigned_sales_user_id, opt_in_status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET name=$2, phone=$3, email=$4, tags=$5, opt_in_status=$7, notes=$8
         RETURNING *`,
        [newId, c.name, c.phone, c.email || null, c.tags || [], c.assignedSalesUserId || null, c.optInStatus ?? true, c.notes || null]
      );
      inserted.push(mapCustomer(row));
    }
    res.status(201).json(inserted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to import customers' });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, phone, email, tags, assignedSalesUserId, optInStatus, notes } = req.body;
  try {
    const row = await queryOne(
      `UPDATE customers SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        tags = COALESCE($4, tags),
        assigned_sales_user_id = $5,
        opt_in_status = COALESCE($6, opt_in_status),
        notes = COALESCE($7, notes)
       WHERE id = $8 RETURNING *`,
      [name, phone, email, tags, assignedSalesUserId ?? null, optInStatus, notes, id]
    );
    if (!row) return res.status(404).json({ message: 'Customer not found' });
    res.json(mapCustomer(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update customer' });
  }
});

// DELETE /api/customers  (body: { ids: string[] })
router.delete('/', async (req: AuthRequest, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'ids array is required' });
  }
  try {
    await deleteByIds('customers', ids);
    res.json({ deleted: ids.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete customers' });
  }
});

export default router;
