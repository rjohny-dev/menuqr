const pool = require('../db');

const FORMATO_SLUG = /^[a-z0-9-]{2,100}$/;

const buscarCardapioPublico = async (req, res) => {
  const { slug } = req.params;

  if (!FORMATO_SLUG.test(slug)) {
    return res.status(404).json({ error: 'Cardápio não encontrado' });
  }

  try {
    const resultadoRestaurante = await pool.query(
      'SELECT id, name, slug, logo_url, whatsapp FROM restaurants WHERE slug = $1',
      [slug]
    );
    if (resultadoRestaurante.rows.length === 0) {
      return res.status(404).json({ error: 'Cardápio não encontrado' });
    }
    const restaurante = resultadoRestaurante.rows[0];

    // Query 1: categorias + itens (sem N+1)
    const resultadoLinhas = await pool.query(
      `SELECT
         c.id          AS id_categoria,
         c.name        AS nome_categoria,
         c."order"     AS ordem_categoria,
         c.created_at  AS criado_em_categoria,
         i.id          AS id_item,
         i.name        AS nome_item,
         i.description AS descricao_item,
         i.price       AS preco_item,
         i.image_url   AS foto_item,
         i."order"     AS ordem_item,
         i.created_at  AS criado_em_item
       FROM categories c
       LEFT JOIN items i ON i.category_id = c.id AND i.active = true
       WHERE c.restaurant_id = $1
       ORDER BY c."order" ASC, c.created_at ASC, i."order" ASC, i.created_at ASC`,
      [restaurante.id]
    );

    // Query 2: grupos de opções + opções de todos os itens do restaurante
    const resultadoOpcoes = await pool.query(
      `SELECT
         g.id          AS group_id,
         g.item_id,
         g.name        AS group_name,
         g.required,
         g.min_qty,
         g.max_qty,
         g."order"     AS group_order,
         o.id          AS option_id,
         o.name        AS option_name,
         o.price_add,
         o."order"     AS option_order
       FROM item_option_groups g
       LEFT JOIN item_options o ON o.group_id = g.id
       WHERE g.item_id IN (
         SELECT i.id FROM items i
         JOIN categories c ON c.id = i.category_id
         WHERE c.restaurant_id = $1 AND i.active = true
       )
       ORDER BY g.item_id, g."order" ASC, g.created_at ASC, o."order" ASC, o.created_at ASC`,
      [restaurante.id]
    );

    // Monta mapa: itemId → Map(groupId → grupo com opções)
    const opcoesMap = new Map();
    for (const row of resultadoOpcoes.rows) {
      if (!opcoesMap.has(row.item_id)) opcoesMap.set(row.item_id, new Map());
      const grupos = opcoesMap.get(row.item_id);
      if (!grupos.has(row.group_id)) {
        grupos.set(row.group_id, {
          id: row.group_id,
          name: row.group_name,
          required: row.required,
          min_qty: row.min_qty,
          max_qty: row.max_qty,
          order: row.group_order,
          options: [],
        });
      }
      if (row.option_id) {
        grupos.get(row.group_id).options.push({
          id: row.option_id,
          name: row.option_name,
          price_add: row.price_add,
          order: row.option_order,
        });
      }
    }

    // Monta estrutura final: categorias → itens (com option_groups embutido)
    const mapaDeCategoria = new Map();
    for (const linha of resultadoLinhas.rows) {
      if (!mapaDeCategoria.has(linha.id_categoria)) {
        mapaDeCategoria.set(linha.id_categoria, {
          id: linha.id_categoria,
          name: linha.nome_categoria,
          order: linha.ordem_categoria,
          created_at: linha.criado_em_categoria,
          items: [],
        });
      }
      if (linha.id_item) {
        const grupos = opcoesMap.get(linha.id_item);
        mapaDeCategoria.get(linha.id_categoria).items.push({
          id: linha.id_item,
          name: linha.nome_item,
          description: linha.descricao_item,
          price: linha.preco_item,
          image_url: linha.foto_item,
          order: linha.ordem_item,
          created_at: linha.criado_em_item,
          option_groups: grupos ? [...grupos.values()] : [],
        });
      }
    }

    res.json({ restaurant: restaurante, categories: [...mapaDeCategoria.values()] });
  } catch (err) {
    console.error('buscarCardapioPublico error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { buscarCardapioPublico };
