const pool = require('../db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getRestaurantId = async (userId) => {
  const result = await pool.query('SELECT id FROM restaurants WHERE user_id = $1', [userId]);
  return result.rows[0]?.id;
};

const getCategories = async (req, res) => {
  try {
    const restaurantId = await getRestaurantId(req.user.userId);
    if (!restaurantId) return res.status(404).json({ error: 'Restaurante não encontrado' });
    const result = await pool.query(
      'SELECT id, restaurant_id, name, "order", created_at FROM categories WHERE restaurant_id = $1 ORDER BY "order" ASC, created_at ASC',
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getCategories error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createCategory = async (req, res) => {
  // Body sanitized by validate(categoryCreateSchema)
  const { name, order } = req.body;
  try {
    const restaurantId = await getRestaurantId(req.user.userId);
    if (!restaurantId) return res.status(404).json({ error: 'Restaurante não encontrado' });
    const result = await pool.query(
      'INSERT INTO categories (restaurant_id, name, "order") VALUES ($1, $2, $3) RETURNING id, restaurant_id, name, "order", created_at',
      [restaurantId, name, order ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createCategory error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });
  const { name, order } = req.body;
  try {
    const restaurantId = await getRestaurantId(req.user.userId);
    if (!restaurantId) return res.status(404).json({ error: 'Restaurante não encontrado' });
    const result = await pool.query(
      `UPDATE categories
       SET name = COALESCE($1, name), "order" = COALESCE($2, "order")
       WHERE id = $3 AND restaurant_id = $4
       RETURNING id, restaurant_id, name, "order", created_at`,
      [name ?? null, order ?? null, id, restaurantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateCategory error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const restaurantId = await getRestaurantId(req.user.userId);
    if (!restaurantId) return res.status(404).json({ error: 'Restaurante não encontrado' });
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [id, restaurantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteCategory error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
