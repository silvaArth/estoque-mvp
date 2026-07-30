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

// Importação em massa de itens a partir de planilha (Excel / CSV)
router.post('/importar', async (req, res) => {
  const { itens, substituir = false } = req.body;

  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ erro: 'Nenhum item válido encontrado na planilha para importar.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (substituir) {
      await client.query('TRUNCATE TABLE EstoqueAtual RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE Movimentacao RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE Item RESTART IDENTITY CASCADE');
    }

    let importados = 0;
    for (const item of itens) {
      const cod = String(item.codigo_barras || '').trim();
      const desc = String(item.descricao || cod).trim();
      const sku = String(item.sku || cod).trim();

      if (!cod) continue;

      await client.query(
        `INSERT INTO Item (sku, codigo_barras, descricao)
         VALUES ($1, $2, $3)
         ON CONFLICT (codigo_barras)
         DO UPDATE SET descricao = EXCLUDED.descricao, sku = EXCLUDED.sku`,
        [sku, cod, desc]
      );
      importados++;
    }

    await client.query('COMMIT');
    res.json({
      mensagem: `${importados} produto(s) importados e disponibilizados para endereçamento com sucesso!`,
      total: importados,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao importar itens da planilha.', detalhe: err.message });
  } finally {
    client.release();
  }
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

// Deletar um produto específico pelo código de barras ou SKU (e seu estoque/movimentações associadas)
router.delete('/:codigo_barras', async (req, res) => {
  const { codigo_barras } = req.params;
  const cod = codigo_barras.trim();
  try {
    const itemRes = await pool.query(
      'SELECT id, codigo_barras, descricao FROM Item WHERE UPPER(codigo_barras) = UPPER($1) OR UPPER(sku) = UPPER($1)',
      [cod]
    );
    if (!itemRes.rows.length) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    const item = itemRes.rows[0];
    await pool.query('DELETE FROM EstoqueAtual WHERE item_id = $1', [item.id]);
    await pool.query('DELETE FROM Movimentacao WHERE item_id = $1', [item.id]);
    await pool.query('DELETE FROM Item WHERE id = $1', [item.id]);
    res.json({ mensagem: `Produto "${item.descricao}" (${item.codigo_barras}) e seus registros foram excluídos.` });
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
