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
  const { codigo_barras, descricao, sku } = req.body;
  if (!codigo_barras || !descricao) {
    return res.status(400).json({ erro: 'Código de barras e Descrição são obrigatórios.' });
  }
  const finalSku = (sku && sku.trim()) ? sku.trim() : codigo_barras.trim();
  try {
    const { rows } = await pool.query(
      `INSERT INTO Item (sku, codigo_barras, descricao) VALUES ($1, $2, $3) RETURNING *`,
      [finalSku, codigo_barras.trim(), descricao.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um produto com este código de barras ou SKU.' });
    }
    res.status(500).json({ erro: 'Erro ao cadastrar produto.', detalhe: err.message });
  }
});

// Deletar um produto específico pelo código de barras (e suas movimentações associadas)
router.delete('/:codigo_barras', async (req, res) => {
  const { codigo_barras } = req.params;
  try {
    const itemRes = await pool.query('SELECT id FROM Item WHERE codigo_barras = $1', [codigo_barras]);
    if (!itemRes.rows.length) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    const itemId = itemRes.rows[0].id;
    await pool.query('DELETE FROM Movimentacao WHERE item_id = $1', [itemId]);
    await pool.query('DELETE FROM Item WHERE id = $1', [itemId]);
    res.json({ mensagem: `Produto "${codigo_barras}" e seu histórico foram removidos.` });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar produto.', detalhe: err.message });
  }
});

// Limpar TODOS os produtos e historico de movimentações para reiniciar o banco
router.delete('/', async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE Movimentacao RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE Item RESTART IDENTITY CASCADE');
    res.json({ mensagem: 'Todos os produtos e movimentações foram apagados com sucesso.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao limpar produtos.', detalhe: err.message });
  }
});

module.exports = router;
