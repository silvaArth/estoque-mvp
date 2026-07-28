const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM Item ORDER BY descricao');
  res.json(rows);
});

// Resolve código de barras escaneado -> dados do produto
router.get('/:codigo_barras', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM Item WHERE codigo_barras = $1',
    [req.params.codigo_barras]
  );
  if (!rows.length) {
    return res.status(404).json({ erro: 'Produto não encontrado para este código.' });
  }
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { sku, codigo_barras, descricao } = req.body;
  if (!sku || !codigo_barras || !descricao) {
    return res.status(400).json({ erro: 'sku, codigo_barras e descricao são obrigatórios.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO Item (sku, codigo_barras, descricao) VALUES ($1, $2, $3) RETURNING *`,
      [sku, codigo_barras, descricao]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um produto com esse SKU ou código de barras.' });
    }
    throw err;
  }
});

module.exports = router;
