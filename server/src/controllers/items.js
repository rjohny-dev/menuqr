const pool = require('../db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getRestaurantId = async (userId) => {
  const result = await pool.query('SELECT id FROM restaurants WHERE user_id = $1', [userId]);
  return result.rows[0]?.id;
};

const validateCategoryOwnership = async (categoryId, restaurantId) => {
  const result = await pool.query(
    'SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2',
    [categoryId, restaurantId]
  );
  return result.rows.length > 0;
};

const ITEM_COLUMNS = 'id, category_id, name, description, price, image_url, active, "order", created_at';

const getItems = async (req, res) => {
  const { categoryId } = req.params;
  if (!UUID_RE.test(categoryId)) return res.status(400).json({ error: 'ID de categoria inválido' });
  try {
    const restaurantId = await getRestaurantId(req.user.userId);
    if (!restaurantId) return res.status(404).json({ error: 'Restaurante não encontrado' });
    if (!(await validateCategoryOwnership(categoryId, restaurantId))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const result = await pool.query(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE category_id = $1 ORDER BY "order" ASC, created_at ASC`,
      [categoryId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getItems error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createItem = async (req, res) => {
  const { categoryId } = req.params;
  if (!UUID_RE.test(categoryId)) return res.status(400).json({ error: 'ID de categoria inválido' });
  // Body sanitized by validate(itemCreateSchema)
  const { name, description, price, image_url, active, order } = req.body;
  try {
    const restaurantId = await getRestaurantId(req.user.userId);
    if (!restaurantId) return res.status(404).json({ error: 'Restaurante não encontrado' });
    if (!(await validateCategoryOwnership(categoryId, restaurantId))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const result = await pool.query(
      `INSERT INTO items (category_id, name, description, price, image_url, active, "order")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${ITEM_COLUMNS}`,
      [categoryId, name, description ?? null, price, image_url ?? null, active ?? true, order ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createItem error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateItem = async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });
  // Body sanitized by validate(itemUpdateSchema)
  const { name, description, price, image_url, active, order } = req.body;
  try {
    const restaurantId = await getRestaurantId(req.user.userId);
    if (!restaurantId) return res.status(404).json({ error: 'Restaurante não encontrado' });
    // Ownership enforced via subquery — user can only update items in their own restaurant
    const result = await pool.query(
      `UPDATE items
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           price       = COALESCE($3, price),
           image_url   = COALESCE($4, image_url),
           active      = COALESCE($5, active),
           "order"     = COALESCE($6, "order")
       WHERE id = $7
         AND category_id IN (SELECT id FROM categories WHERE restaurant_id = $8)
       RETURNING ${ITEM_COLUMNS}`,
      [name ?? null, description ?? null, price ?? null, image_url ?? null, active ?? null, order ?? null, id, restaurantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateItem error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteItem = async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const restaurantId = await getRestaurantId(req.user.userId);
    if (!restaurantId) return res.status(404).json({ error: 'Restaurante não encontrado' });
    const result = await pool.query(
      `DELETE FROM items
       WHERE id = $1
         AND category_id IN (SELECT id FROM categories WHERE restaurant_id = $2)
       RETURNING id`,
      [id, restaurantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteItem error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getItems, createItem, updateItem, deleteItem };
