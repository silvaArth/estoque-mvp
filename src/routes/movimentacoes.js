const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const TIPOS_VALIDOS = ['entrada', 'saida'];

// Registra uma movimentação. O front sempre manda códigos de barras
// (escaneados ou digitados), nunca IDs internos - a resolução acontece aqui.
//
// Nota de design: se o código de item ou localização não existir, hoje a API
// bloqueia com um erro claro (ver bloco abaixo). Deixamos a estrutura pronta
// para no futuro permitir cadastro rápido inline nesse ponto, caso vire
// necessário - hoje é resolvido apenas quando/se isso for confirmado como
// funcionalidade desejada.
router.post('/', async (req, res) => {
  const { item_codigo_barras, localizacao_codigo_barras, tipo, quantidade = 1, operador } = req.body;

  if (!item_codigo_barras || !localizacao_codigo_barras || !tipo) {
    return res.status(400).json({
      erro: 'item_codigo_barras, localizacao_codigo_barras e tipo são obrigatórios.',
    });
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ erro: `tipo deve ser um de: ${TIPOS_VALIDOS.join(', ')}` });
  }
  const qtd = Number(quantidade) || 1;
  if (qtd <= 0) {
    return res.status(400).json({ erro: 'quantidade deve ser maior que zero.' });
  }

  const itemCod = item_codigo_barras.trim();
  const localCod = localizacao_codigo_barras.trim();

  const itemResult = await pool.query(
    'SELECT id FROM Item WHERE UPPER(codigo_barras) = UPPER($1) OR UPPER(sku) = UPPER($1) OR UPPER(codigo_pequeno) = UPPER($1)',
    [itemCod]
  );
  if (!itemResult.rows.length) {
    return res.status(404).json({
      erro: 'codigo_nao_encontrado',
      campo: 'item_codigo_barras',
      mensagem: `Produto com código "${itemCod}" não encontrado.`,
    });
  }

  const localResult = await pool.query(
    'SELECT id FROM Localizacao WHERE UPPER(codigo_barras) = UPPER($1)',
    [localCod]
  );
  if (!localResult.rows.length) {
    return res.status(404).json({
      erro: 'codigo_nao_encontrado',
      campo: 'localizacao_codigo_barras',
      mensagem: `Localização com código "${localCod}" não encontrada.`,
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO Movimentacao (item_id, localizacao_id, tipo, quantidade, operador)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [itemResult.rows[0].id, localResult.rows[0].id, tipo, qtd, operador || null]
  );

  res.status(201).json(rows[0]);
});

// Histórico, filtrável por item ou localização (por código de barras)
router.get('/', async (req, res) => {
  const { item_codigo_barras, localizacao_codigo_barras } = req.query;
  const conditions = [];
  const params = [];
  let joins = 'FROM Movimentacao m JOIN Item i ON i.id = m.item_id JOIN Localizacao l ON l.id = m.localizacao_id';

  if (item_codigo_barras) {
    params.push(item_codigo_barras);
    conditions.push(`i.codigo_barras = $${params.length}`);
  }
  if (localizacao_codigo_barras) {
    params.push(localizacao_codigo_barras);
    conditions.push(`l.codigo_barras = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT m.*, i.sku, i.descricao, l.codigo_barras AS localizacao_codigo_barras
     ${joins} ${where} ORDER BY m.timestamp DESC LIMIT 200`,
    params
  );
  res.json(rows);
});

module.exports = router;
