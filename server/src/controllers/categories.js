const pool = require('../db');

// Regex para validar formato UUID antes de consultar o banco
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Busca o ID do restaurante a partir do ID do usuário logado
const buscarIdDoRestaurante = async (idDoUsuario) => {
  const resultado = await pool.query('SELECT id FROM restaurants WHERE user_id = $1', [idDoUsuario]);
  return resultado.rows[0]?.id;
};

const getCategories = async (req, res) => {
  try {
    const idDoRestaurante = await buscarIdDoRestaurante(req.user.userId);
    if (!idDoRestaurante) return res.status(404).json({ error: 'Restaurante não encontrado' });

    const resultado = await pool.query(
      'SELECT id, restaurant_id, name, "order", created_at FROM categories WHERE restaurant_id = $1 ORDER BY "order" ASC, created_at ASC',
      [idDoRestaurante]
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error('getCategories error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createCategory = async (req, res) => {
  // Dados já validados pelo middleware validate(categoryCreateSchema)
  const { name, order } = req.body;
  try {
    const idDoRestaurante = await buscarIdDoRestaurante(req.user.userId);
    if (!idDoRestaurante) return res.status(404).json({ error: 'Restaurante não encontrado' });

    const resultado = await pool.query(
      'INSERT INTO categories (restaurant_id, name, "order") VALUES ($1, $2, $3) RETURNING id, restaurant_id, name, "order", created_at',
      [idDoRestaurante, name, order ?? 0]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error('createCategory error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  if (!FORMATO_UUID.test(id)) return res.status(400).json({ error: 'ID inválido' });

  const { name, order } = req.body;
  try {
    const idDoRestaurante = await buscarIdDoRestaurante(req.user.userId);
    if (!idDoRestaurante) return res.status(404).json({ error: 'Restaurante não encontrado' });

    // A condição AND restaurant_id = $4 garante que o usuário só edita suas próprias categorias
    const resultado = await pool.query(
      `UPDATE categories
       SET name = COALESCE($1, name), "order" = COALESCE($2, "order")
       WHERE id = $3 AND restaurant_id = $4
       RETURNING id, restaurant_id, name, "order", created_at`,
      [name ?? null, order ?? null, id, idDoRestaurante]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('updateCategory error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  if (!FORMATO_UUID.test(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const idDoRestaurante = await buscarIdDoRestaurante(req.user.userId);
    if (!idDoRestaurante) return res.status(404).json({ error: 'Restaurante não encontrado' });

    // O CASCADE no schema apaga automaticamente todos os itens da categoria
    const resultado = await pool.query(
      'DELETE FROM categories WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [id, idDoRestaurante]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteCategory error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
