const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// "Onde está o item X?"
router.get('/item/:codigo_barras', async (req, res) => {
  const cod = req.params.codigo_barras.trim();

  try {
    // Verifica se o produto existe no cadastro
    const itemCheck = await pool.query(
      `SELECT id, codigo_barras, descricao FROM Item 
       WHERE UPPER(codigo_barras) = UPPER($1) OR (LENGTH(codigo_barras) >= 6 AND LEFT(RIGHT(codigo_barras, 6), 5) = $1)`,
      [cod]
    );

    if (!itemCheck.rows.length) {
      return res.status(404).json({
        existe: false,
        erro: 'produto_nao_cadastrado',
        mensagem: `O produto "${cod}" não está cadastrado no sistema.`
      });
    }

    const item = itemCheck.rows[0];

    // Busca as posições ativas do produto no estoque
    const { rows } = await pool.query(
      `SELECT l.codigo_barras AS localizacao_codigo_barras, l.rack, l.coluna, l.prateleira,
              e.quantidade, e.tipo, e.timestamp
       FROM EstoqueAtual e
       JOIN Localizacao l ON l.id = e.localizacao_id
       WHERE e.item_id = $1 AND e.tipo != 'saida'
       ORDER BY e.timestamp DESC`,
      [item.id]
    );

    res.json({
      existe: true,
      produto: item,
      posicoes: rows
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar produto no estoque.', detalhe: err.message });
  }
});

// "O que tem nessa posição?"
router.get('/localizacao/:codigo_barras', async (req, res) => {
  const cod = req.params.codigo_barras.trim();

  try {
    // Verifica se a posição existe no cadastro
    const localCheck = await pool.query(
      `SELECT id, codigo_barras, rack, coluna, prateleira FROM Localizacao WHERE UPPER(codigo_barras) = UPPER($1)`,
      [cod]
    );

    if (!localCheck.rows.length) {
      return res.status(404).json({
        existe: false,
        erro: 'posicao_nao_cadastrada',
        mensagem: `A posição "${cod}" não está cadastrada no sistema.`
      });
    }

    const localizacao = localCheck.rows[0];

    // Busca o item armazenado nessa posição
    const { rows } = await pool.query(
      `SELECT i.codigo_barras, i.descricao, e.quantidade, e.tipo, e.timestamp
       FROM EstoqueAtual e
       JOIN Item i ON i.id = e.item_id
       WHERE e.localizacao_id = $1`,
      [localizacao.id]
    );

    if (!rows.length || rows[0].tipo === 'saida') {
      return res.json({ existe: true, ocupada: false, localizacao });
    }

    res.json({ existe: true, ocupada: true, localizacao, ...rows[0] });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar posição no estoque.', detalhe: err.message });
  }
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
