const pool = require('../db');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const donoDaItem = async (itemId, userId) => {
  const r = await pool.query(
    `SELECT i.id FROM items i
     JOIN categories c ON c.id = i.category_id
     JOIN restaurants r ON r.id = c.restaurant_id
     WHERE i.id = $1 AND r.user_id = $2`,
    [itemId, userId]
  );
  return r.rows.length > 0;
};

const donoDaGrupo = async (groupId, userId) => {
  const r = await pool.query(
    `SELECT g.id FROM item_option_groups g
     JOIN items i ON i.id = g.item_id
     JOIN categories c ON c.id = i.category_id
     JOIN restaurants r ON r.id = c.restaurant_id
     WHERE g.id = $1 AND r.user_id = $2`,
    [groupId, userId]
  );
  return r.rows.length > 0;
};

const donoDaOpcao = async (optionId, userId) => {
  const r = await pool.query(
    `SELECT o.id FROM item_options o
     JOIN item_option_groups g ON g.id = o.group_id
     JOIN items i ON i.id = g.item_id
     JOIN categories c ON c.id = i.category_id
     JOIN restaurants r ON r.id = c.restaurant_id
     WHERE o.id = $1 AND r.user_id = $2`,
    [optionId, userId]
  );
  return r.rows.length > 0;
};

const getGroups = async (req, res) => {
  const { itemId } = req.params;
  if (!UUID.test(itemId)) return res.status(400).json({ error: 'ID inválido' });
  try {
    if (!(await donoDaItem(itemId, req.user.userId)))
      return res.status(403).json({ error: 'Acesso negado' });

    const result = await pool.query(
      `SELECT g.id, g.name, g.required, g.min_qty, g.max_qty, g."order",
              COALESCE(
                json_agg(
                  json_build_object('id', o.id, 'name', o.name, 'price_add', o.price_add, 'order', o."order")
                  ORDER BY o."order" ASC, o.created_at ASC
                ) FILTER (WHERE o.id IS NOT NULL),
                '[]'
              ) AS options
       FROM item_option_groups g
       LEFT JOIN item_options o ON o.group_id = g.id
       WHERE g.item_id = $1
       GROUP BY g.id, g.name, g.required, g.min_qty, g.max_qty, g."order", g.created_at
       ORDER BY g."order" ASC, g.created_at ASC`,
      [itemId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getGroups:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
};

const createGroup = async (req, res) => {
  const { itemId } = req.params;
  if (!UUID.test(itemId)) return res.status(400).json({ error: 'ID inválido' });
  const { name, required, min_qty, max_qty, order } = req.body;
  try {
    if (!(await donoDaItem(itemId, req.user.userId)))
      return res.status(403).json({ error: 'Acesso negado' });

    const r = await pool.query(
      `INSERT INTO item_option_groups (item_id, name, required, min_qty, max_qty, "order")
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, required, min_qty, max_qty, "order"`,
      [itemId, name, required ?? false, min_qty ?? 0, max_qty ?? 1, order ?? 0]
    );
    res.status(201).json({ ...r.rows[0], options: [] });
  } catch (err) {
    console.error('createGroup:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
};

const updateGroup = async (req, res) => {
  const { id } = req.params;
  if (!UUID.test(id)) return res.status(400).json({ error: 'ID inválido' });
  const { name, required, min_qty, max_qty, order } = req.body;
  try {
    if (!(await donoDaGrupo(id, req.user.userId)))
      return res.status(403).json({ error: 'Acesso negado' });

    const r = await pool.query(
      `UPDATE item_option_groups
       SET name     = COALESCE($1, name),
           required = COALESCE($2, required),
           min_qty  = COALESCE($3, min_qty),
           max_qty  = COALESCE($4, max_qty),
           "order"  = COALESCE($5, "order")
       WHERE id = $6
       RETURNING id, name, required, min_qty, max_qty, "order"`,
      [name ?? null, required ?? null, min_qty ?? null, max_qty ?? null, order ?? null, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Grupo não encontrado' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('updateGroup:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
};

const deleteGroup = async (req, res) => {
  const { id } = req.params;
  if (!UUID.test(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    if (!(await donoDaGrupo(id, req.user.userId)))
      return res.status(403).json({ error: 'Acesso negado' });
    await pool.query('DELETE FROM item_option_groups WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteGroup:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
};

const createOption = async (req, res) => {
  const { groupId } = req.params;
  if (!UUID.test(groupId)) return res.status(400).json({ error: 'ID inválido' });
  const { name, price_add, order } = req.body;
  try {
    if (!(await donoDaGrupo(groupId, req.user.userId)))
      return res.status(403).json({ error: 'Acesso negado' });

    const r = await pool.query(
      `INSERT INTO item_options (group_id, name, price_add, "order")
       VALUES ($1,$2,$3,$4)
       RETURNING id, group_id, name, price_add, "order"`,
      [groupId, name, price_add ?? 0, order ?? 0]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('createOption:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
};

const updateOption = async (req, res) => {
  const { optionId } = req.params;
  if (!UUID.test(optionId)) return res.status(400).json({ error: 'ID inválido' });
  const { name, price_add, order } = req.body;
  try {
    if (!(await donoDaOpcao(optionId, req.user.userId)))
      return res.status(403).json({ error: 'Acesso negado' });

    const r = await pool.query(
      `UPDATE item_options
       SET name      = COALESCE($1, name),
           price_add = COALESCE($2, price_add),
           "order"   = COALESCE($3, "order")
       WHERE id = $4
       RETURNING id, group_id, name, price_add, "order"`,
      [name ?? null, price_add ?? null, order ?? null, optionId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Opção não encontrada' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('updateOption:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
};

const deleteOption = async (req, res) => {
  const { optionId } = req.params;
  if (!UUID.test(optionId)) return res.status(400).json({ error: 'ID inválido' });
  try {
    if (!(await donoDaOpcao(optionId, req.user.userId)))
      return res.status(403).json({ error: 'Acesso negado' });
    await pool.query('DELETE FROM item_options WHERE id = $1', [optionId]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteOption:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
};

module.exports = { getGroups, createGroup, updateGroup, deleteGroup, createOption, updateOption, deleteOption };
