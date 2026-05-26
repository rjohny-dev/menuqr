const pool = require('../db');

// Regex para validar formato UUID antes de consultar o banco
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Campos retornados nas respostas de itens
const CAMPOS_DO_ITEM = 'id, category_id, name, description, price, image_url, active, "order", created_at';

// Busca o ID do restaurante a partir do ID do usuário logado
const buscarIdDoRestaurante = async (idDoUsuario) => {
  const resultado = await pool.query('SELECT id FROM restaurants WHERE user_id = $1', [idDoUsuario]);
  return resultado.rows[0]?.id;
};

// Verifica se a categoria pertence ao restaurante do usuário — impede acesso cruzado entre contas
const verificarDonidadeCategoria = async (idDaCategoria, idDoRestaurante) => {
  const resultado = await pool.query(
    'SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2',
    [idDaCategoria, idDoRestaurante]
  );
  return resultado.rows.length > 0;
};

const getItems = async (req, res) => {
  const { categoryId } = req.params;
  if (!FORMATO_UUID.test(categoryId)) return res.status(400).json({ error: 'ID de categoria inválido' });

  try {
    const idDoRestaurante = await buscarIdDoRestaurante(req.user.userId);
    if (!idDoRestaurante) return res.status(404).json({ error: 'Restaurante não encontrado' });

    if (!(await verificarDonidadeCategoria(categoryId, idDoRestaurante))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const resultado = await pool.query(
      `SELECT ${CAMPOS_DO_ITEM} FROM items WHERE category_id = $1 ORDER BY "order" ASC, created_at ASC`,
      [categoryId]
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error('getItems error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createItem = async (req, res) => {
  const { categoryId } = req.params;
  if (!FORMATO_UUID.test(categoryId)) return res.status(400).json({ error: 'ID de categoria inválido' });

  // Dados já validados pelo middleware validate(itemCreateSchema)
  const { name, description, price, image_url, active, order } = req.body;
  try {
    const idDoRestaurante = await buscarIdDoRestaurante(req.user.userId);
    if (!idDoRestaurante) return res.status(404).json({ error: 'Restaurante não encontrado' });

    if (!(await verificarDonidadeCategoria(categoryId, idDoRestaurante))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const resultado = await pool.query(
      `INSERT INTO items (category_id, name, description, price, image_url, active, "order")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${CAMPOS_DO_ITEM}`,
      [categoryId, name, description ?? null, price, image_url ?? null, active ?? true, order ?? 0]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error('createItem error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateItem = async (req, res) => {
  const { id } = req.params;
  if (!FORMATO_UUID.test(id)) return res.status(400).json({ error: 'ID inválido' });

  // Dados já validados pelo middleware validate(itemUpdateSchema)
  const { name, description, price, image_url, active, order } = req.body;
  try {
    const idDoRestaurante = await buscarIdDoRestaurante(req.user.userId);
    if (!idDoRestaurante) return res.status(404).json({ error: 'Restaurante não encontrado' });

    // O subquery garante que o usuário só edita itens do seu próprio restaurante
    const resultado = await pool.query(
      `UPDATE items
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           price       = COALESCE($3, price),
           image_url   = COALESCE($4, image_url),
           active      = COALESCE($5, active),
           "order"     = COALESCE($6, "order")
       WHERE id = $7
         AND category_id IN (SELECT id FROM categories WHERE restaurant_id = $8)
       RETURNING ${CAMPOS_DO_ITEM}`,
      [name ?? null, description ?? null, price ?? null, image_url ?? null, active ?? null, order ?? null, id, idDoRestaurante]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('updateItem error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteItem = async (req, res) => {
  const { id } = req.params;
  if (!FORMATO_UUID.test(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const idDoRestaurante = await buscarIdDoRestaurante(req.user.userId);
    if (!idDoRestaurante) return res.status(404).json({ error: 'Restaurante não encontrado' });

    // O subquery garante que o usuário só apaga itens do seu próprio restaurante
    const resultado = await pool.query(
      `DELETE FROM items
       WHERE id = $1
         AND category_id IN (SELECT id FROM categories WHERE restaurant_id = $2)
       RETURNING id`,
      [id, idDoRestaurante]
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteItem error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getItems, createItem, updateItem, deleteItem };
