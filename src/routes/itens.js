const express = require('express');
const { pool } = require('../db');

const router = express.Router();


router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM Item ORDER BY descricao');
  res.json(rows);
});

// Resolve código de barras escaneado ou Código Pequeno -> dados do produto
router.get('/:codigo_barras', async (req, res) => {
  const cod = req.params.codigo_barras.trim();
  const { rows } = await pool.query(
    'SELECT * FROM Item WHERE UPPER(codigo_barras) = UPPER($1) OR (LENGTH(codigo_barras) >= 6 AND LEFT(RIGHT(codigo_barras, 6), 5) = $1)',
    [cod]
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

    let importados = 0;
    for (const item of itens) {
      const cod = String(item.codigo_barras || '').trim();
      const desc = String(item.descricao || cod).trim();
      if (!cod) continue;

      await client.query(
        `INSERT INTO Item (codigo_barras, descricao)
         VALUES ($1, $2)
         ON CONFLICT (codigo_barras)
         DO UPDATE SET descricao = EXCLUDED.descricao`,
        [cod, desc]
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

// Importação em massa com Posicao (Endereçamento opcional)
router.post('/importar-com-posicao', async (req, res) => {
  const { itens } = req.body;

  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ erro: 'Nenhum item válido encontrado na planilha para importar.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let importados = 0;
    let endereçados = 0;
    const errosPosicao = [];

    for (const item of itens) {
      const cod = String(item.codigo_barras || '').trim();
      const desc = String(item.descricao || cod).trim();
      const pos = String(item.posicao || '').trim();
      const qtd = Number(item.quantidade) > 0 ? Number(item.quantidade) : 1;

      if (!cod) continue;

      // 1. Inserir ou atualizar produto na tabela Item
      const itemRes = await client.query(
        `INSERT INTO Item (codigo_barras, descricao)
         VALUES ($1, $2)
         ON CONFLICT (codigo_barras)
         DO UPDATE SET descricao = EXCLUDED.descricao
         RETURNING id`,
        [cod, desc]
      );
      const itemId = itemRes.rows[0].id;
      importados++;

      // 2. Se a posição foi informada, buscar e criar movimentação de entrada
      if (pos) {
        const localRes = await client.query(
          'SELECT id FROM Localizacao WHERE UPPER(codigo_barras) = UPPER($1)',
          [pos]
        );

        if (localRes.rows.length) {
          const localId = localRes.rows[0].id;
          await client.query(
            `INSERT INTO Movimentacao (item_id, localizacao_id, tipo, quantidade, operador)
             VALUES ($1, $2, 'entrada', $3, 'Importação')`,
            [itemId, localId, qtd]
          );
          endereçados++;
        } else {
          errosPosicao.push(`Posição "${pos}" não encontrada para o produto "${cod}".`);
        }
      }
    }

    await client.query('COMMIT');
    res.json({
      mensagem: `${importados} produto(s) importados (${endereçados} endereçados com sucesso)!`,
      importados,
      endereçados,
      errosPosicao
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao importar itens com posição da planilha.', detalhe: err.message });
  } finally {
    client.release();
  }
});

router.post('/', async (req, res) => {
  const { codigo_barras, descricao } = req.body;
  if (!codigo_barras || !descricao) {
    return res.status(400).json({ erro: 'Código de barras e Descrição são obrigatórios.' });
  }
  const cod = codigo_barras.trim();
  try {
    const { rows } = await pool.query(
      `INSERT INTO Item (codigo_barras, descricao) VALUES ($1, $2) RETURNING *`,
      [cod, descricao.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um produto com este código de barras.' });
    }
    res.status(500).json({ erro: 'Erro ao cadastrar produto.', detalhe: err.message });
  }
});

// Deletar um produto específico pelo código de barras ou Código Pequeno (e seu estoque/movimentações associadas)
router.delete('/:codigo_barras', async (req, res) => {
  const { codigo_barras } = req.params;
  const cod = codigo_barras.trim();
  try {
    const itemRes = await pool.query(
      'SELECT id, codigo_barras, descricao FROM Item WHERE UPPER(codigo_barras) = UPPER($1) OR (LENGTH(codigo_barras) >= 6 AND LEFT(RIGHT(codigo_barras, 6), 5) = $1)',
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
