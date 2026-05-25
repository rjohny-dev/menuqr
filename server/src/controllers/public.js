const pool = require('../db');

const SLUG_RE = /^[a-z0-9-]{2,100}$/;

const getMenuBySlug = async (req, res) => {
  const { slug } = req.params;

  // Validate slug before hitting DB — prevents path traversal and odd queries
  if (!SLUG_RE.test(slug)) {
    return res.status(404).json({ error: 'Cardápio não encontrado' });
  }

  try {
    const restaurantResult = await pool.query(
      'SELECT id, name, slug, logo_url, whatsapp FROM restaurants WHERE slug = $1',
      [slug]
    );
    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cardápio não encontrado' });
    }
    const restaurant = restaurantResult.rows[0];

    // Single JOIN query instead of N+1 loop — also prevents DoS amplification
    const rowsResult = await pool.query(
      `SELECT
         c.id          AS cat_id,
         c.name        AS cat_name,
         c."order"     AS cat_order,
         c.created_at  AS cat_created_at,
         i.id          AS item_id,
         i.name        AS item_name,
         i.description AS item_description,
         i.price       AS item_price,
         i.image_url   AS item_image_url,
         i."order"     AS item_order,
         i.created_at  AS item_created_at
       FROM categories c
       LEFT JOIN items i ON i.category_id = c.id AND i.active = true
       WHERE c.restaurant_id = $1
       ORDER BY c."order" ASC, c.created_at ASC, i."order" ASC, i.created_at ASC`,
      [restaurant.id]
    );

    // Assemble categories + items from flat rows
    const categoryMap = new Map();
    for (const row of rowsResult.rows) {
      if (!categoryMap.has(row.cat_id)) {
        categoryMap.set(row.cat_id, {
          id: row.cat_id,
          name: row.cat_name,
          order: row.cat_order,
          created_at: row.cat_created_at,
          items: [],
        });
      }
      if (row.item_id) {
        categoryMap.get(row.cat_id).items.push({
          id: row.item_id,
          name: row.item_name,
          description: row.item_description,
          price: row.item_price,
          image_url: row.item_image_url,
          order: row.item_order,
          created_at: row.item_created_at,
        });
      }
    }

    res.json({ restaurant, categories: [...categoryMap.values()] });
  } catch (err) {
    console.error('getMenuBySlug error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getMenuBySlug };
