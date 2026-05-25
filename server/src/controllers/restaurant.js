const pool = require('../db');

// Columns safe to return — never expose internal join keys or future sensitive fields
const SAFE_COLUMNS = 'id, user_id, name, slug, logo_url, description, whatsapp, created_at';

const getRestaurant = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM restaurants WHERE user_id = $1`,
      [req.user.userId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('getRestaurant error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createRestaurant = async (req, res) => {
  // Body already sanitized by validate(restaurantCreateSchema)
  const { name, slug, logo_url, description, whatsapp } = req.body;
  try {
    // Slug uniqueness check antes do INSERT (ON CONFLICT não cobre slug aqui)
    const slugTaken = await pool.query(
      'SELECT id FROM restaurants WHERE slug = $1',
      [slug]
    );
    if (slugTaken.rows.length > 0) {
      return res.status(400).json({ error: 'Esse slug já está em uso' });
    }

    // ON CONFLICT (user_id) elimina a race condition do check-then-insert:
    // mesmo que dois requests cheguem simultaneamente, apenas um vence.
    // Requer UNIQUE constraint em restaurants.user_id — ver migration manual.
    const result = await pool.query(
      `INSERT INTO restaurants (user_id, name, slug, logo_url, description, whatsapp)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING ${SAFE_COLUMNS}`,
      [req.user.userId, name, slug, logo_url ?? null, description ?? null, whatsapp ?? null]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Você já possui um restaurante' });
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createRestaurant error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateRestaurant = async (req, res) => {
  const { name, slug, logo_url, description, whatsapp } = req.body;
  try {
    const current = await pool.query(
      'SELECT id, slug FROM restaurants WHERE user_id = $1',
      [req.user.userId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    if (slug && slug !== current.rows[0].slug) {
      const slugTaken = await pool.query(
        'SELECT id FROM restaurants WHERE slug = $1 AND user_id != $2',
        [slug, req.user.userId]
      );
      if (slugTaken.rows.length > 0) {
        return res.status(400).json({ error: 'Esse slug já está em uso' });
      }
    }
    const result = await pool.query(
      `UPDATE restaurants
       SET name        = COALESCE($1, name),
           slug        = COALESCE($2, slug),
           logo_url    = CASE WHEN $3::TEXT IS NOT NULL THEN $3 ELSE logo_url END,
           description = CASE WHEN $4::TEXT IS NOT NULL THEN $4 ELSE description END,
           whatsapp    = CASE WHEN $5::TEXT IS NOT NULL THEN $5 ELSE whatsapp END
       WHERE user_id = $6
       RETURNING ${SAFE_COLUMNS}`,
      [name ?? null, slug ?? null, logo_url ?? null, description ?? null, whatsapp ?? null, req.user.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateRestaurant error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getRestaurant, createRestaurant, updateRestaurant };
