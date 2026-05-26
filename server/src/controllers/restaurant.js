const pool = require('../db');

// Campos retornados nas respostas — nunca expor campos sensíveis ou chaves internas
const CAMPOS_DO_RESTAURANTE = 'id, user_id, name, slug, logo_url, description, whatsapp, created_at';

const getRestaurant = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT ${CAMPOS_DO_RESTAURANTE} FROM restaurants WHERE user_id = $1`,
      [req.user.userId]
    );
    res.json(resultado.rows[0] || null);
  } catch (err) {
    console.error('getRestaurant error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createRestaurant = async (req, res) => {
  // Dados já validados pelo middleware validate(restaurantCreateSchema)
  const { name, slug, logo_url, description, whatsapp } = req.body;
  try {
    // Verifica se o slug já está em uso antes de tentar inserir
    const slugEmUso = await pool.query(
      'SELECT id FROM restaurants WHERE slug = $1',
      [slug]
    );
    if (slugEmUso.rows.length > 0) {
      return res.status(400).json({ error: 'Esse slug já está em uso' });
    }

    // ON CONFLICT (user_id) protege contra race condition: se dois requests chegarem ao mesmo tempo,
    // apenas o primeiro cria o restaurante. Requer UNIQUE constraint em restaurants.user_id.
    const resultado = await pool.query(
      `INSERT INTO restaurants (user_id, name, slug, logo_url, description, whatsapp)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING ${CAMPOS_DO_RESTAURANTE}`,
      [req.user.userId, name, slug, logo_url ?? null, description ?? null, whatsapp ?? null]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'Você já possui um restaurante' });
    }
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error('createRestaurant error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateRestaurant = async (req, res) => {
  const { name, slug, logo_url, description, whatsapp } = req.body;
  try {
    const restauranteAtual = await pool.query(
      'SELECT id, slug FROM restaurants WHERE user_id = $1',
      [req.user.userId]
    );
    if (restauranteAtual.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }

    // Verifica conflito de slug só se o slug realmente mudou
    if (slug && slug !== restauranteAtual.rows[0].slug) {
      const slugEmUso = await pool.query(
        'SELECT id FROM restaurants WHERE slug = $1 AND user_id != $2',
        [slug, req.user.userId]
      );
      if (slugEmUso.rows.length > 0) {
        return res.status(400).json({ error: 'Esse slug já está em uso' });
      }
    }

    // COALESCE mantém o valor atual se o campo não foi enviado na requisição
    // CASE para campos que aceitam null explícito (logo, descrição, whatsapp)
    const resultado = await pool.query(
      `UPDATE restaurants
       SET name        = COALESCE($1, name),
           slug        = COALESCE($2, slug),
           logo_url    = CASE WHEN $3::TEXT IS NOT NULL THEN $3 ELSE logo_url END,
           description = CASE WHEN $4::TEXT IS NOT NULL THEN $4 ELSE description END,
           whatsapp    = CASE WHEN $5::TEXT IS NOT NULL THEN $5 ELSE whatsapp END
       WHERE user_id = $6
       RETURNING ${CAMPOS_DO_RESTAURANTE}`,
      [name ?? null, slug ?? null, logo_url ?? null, description ?? null, whatsapp ?? null, req.user.userId]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('updateRestaurant error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getRestaurant, createRestaurant, updateRestaurant };
