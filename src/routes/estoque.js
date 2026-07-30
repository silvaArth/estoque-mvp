const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// "Onde está o item X?"
router.get('/item/:codigo_barras', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.codigo_barras AS localizacao_codigo_barras, l.rack, l.coluna, l.prateleira,
            e.quantidade, e.tipo, e.timestamp
     FROM EstoqueAtual e
     JOIN Item i ON i.id = e.item_id
     JOIN Localizacao l ON l.id = e.localizacao_id
     WHERE (i.codigo_barras = $1 OR i.sku = $1) AND e.tipo != 'saida'
     ORDER BY e.timestamp DESC`,
    [req.params.codigo_barras]
  );
  res.json(rows);
});

// "O que tem nessa posição?"
router.get('/localizacao/:codigo_barras', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.sku, i.descricao, e.quantidade, e.tipo, e.timestamp
     FROM EstoqueAtual e
     JOIN Item i ON i.id = e.item_id
     JOIN Localizacao l ON l.id = e.localizacao_id
     WHERE l.codigo_barras = $1`,
    [req.params.codigo_barras]
  );
  if (!rows.length || rows[0].tipo === 'saida') {
    return res.json({ ocupada: false });
  }
  res.json({ ocupada: true, ...rows[0] });
});

// Mapa completo do rack - usado pela visualização em grade no front
router.get('/mapa/:rack', async (req, res) => {
  const { rua } = req.query;
  const conditions = ['l.rack = $1', 'l.ativo = true'];
  const params = [req.params.rack];

  if (rua) {
    params.push(rua);
    conditions.push(`l.rua = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT l.id, l.codigo_barras, l.coluna, l.prateleira, l.rua,
            i.codigo_barras AS item_codigo_barras, i.descricao, e.quantidade, e.tipo
     FROM Localizacao l
     LEFT JOIN EstoqueAtual e ON e.localizacao_id = l.id
     LEFT JOIN Item i ON i.id = e.item_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY l.coluna, l.prateleira`,
    params
  );
  res.json(
    rows.map((r) => ({
      ...r,
      ocupada: Boolean(r.item_codigo_barras) && r.tipo !== 'saida',
    }))
  );
});

module.exports = router;
