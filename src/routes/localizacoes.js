const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Lista todas as posições (uso administrativo / mapa do rack)
router.get('/', async (req, res) => {
  const { rack, ativo } = req.query;
  const conditions = [];
  const params = [];

  if (rack) {
    params.push(rack);
    conditions.push(`rack = $${params.length}`);
  }
  if (ativo !== undefined) {
    params.push(ativo === 'true');
    conditions.push(`ativo = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM Localizacao ${where} ORDER BY rack, coluna, prateleira`,
    params
  );
  res.json(rows);
});

// Resolve código de barras escaneado -> dados da posição
router.get('/:codigo_barras', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM Localizacao WHERE codigo_barras = $1',
    [req.params.codigo_barras]
  );
  if (!rows.length) {
    return res.status(404).json({ erro: 'Localização não encontrada para este código.' });
  }
  res.json(rows[0]);
});

// Cadastro de nova posição (uso administrativo, ex: expansão do estoque)
router.post('/', async (req, res) => {
  const { armazem_id = 1, rack, coluna, prateleira, codigo_barras } = req.body;
  if (!rack || !coluna || !prateleira || !codigo_barras) {
    return res.status(400).json({ erro: 'rack, coluna, prateleira e codigo_barras são obrigatórios.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO Localizacao (armazem_id, rack, coluna, prateleira, codigo_barras)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [armazem_id, rack, coluna, prateleira, codigo_barras]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma localização com esse código ou posição.' });
    }
    throw err;
  }
});

module.exports = router;
