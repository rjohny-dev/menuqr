const pool = require('../db');

// Regex que define o formato válido de um slug: letras minúsculas, números e hífens
const FORMATO_SLUG = /^[a-z0-9-]{2,100}$/;

const buscarCardapioPublico = async (req, res) => {
  const { slug } = req.params;

  // Valida o slug antes de consultar o banco — evita queries desnecessárias e path traversal
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

    // Uma única query com JOIN em vez de um loop N+1 (mais eficiente e sem amplificação de DoS)
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

    // Monta a estrutura de categorias + itens a partir das linhas planas do JOIN
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
        mapaDeCategoria.get(linha.id_categoria).items.push({
          id: linha.id_item,
          name: linha.nome_item,
          description: linha.descricao_item,
          price: linha.preco_item,
          image_url: linha.foto_item,
          order: linha.ordem_item,
          created_at: linha.criado_em_item,
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
