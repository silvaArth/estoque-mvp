const express = require('express');
const XLSX = require('xlsx');
const { pool } = require('../db');

const router = express.Router();

// Resolve um campo interno tipo 'item.sku' dentro do registro combinado
function resolverCampo(registro, campoInterno) {
  const [tabela, campo] = campoInterno.split('.');
  if (tabela === 'localizacao') return registro['localizacao_' + campo];
  if (tabela === 'item') return registro['item_' + campo];
  return registro[campoInterno]; // campos "soltos": quantidade, tipo, timestamp
}

async function obterLinhasExportacao() {
  const [dadosResult, mapaResult] = await Promise.all([
    pool.query(
      `SELECT l.codigo_barras AS localizacao_codigo_barras,
              i.codigo_barras AS item_codigo_barras, i.descricao AS item_descricao,
              e.quantidade, e.tipo, e.timestamp
       FROM EstoqueAtual e
       JOIN Item i ON i.id = e.item_id
       JOIN Localizacao l ON l.id = e.localizacao_id
       WHERE e.tipo != 'saida'
       ORDER BY l.codigo_barras`
    ),
    pool.query(
      'SELECT campo_interno, nome_coluna FROM MapeamentoExportacao WHERE ativo = true ORDER BY ordem'
    ),
  ]);

  const mapeamento = mapaResult.rows;
  if (!mapeamento.length) return null;

  return dadosResult.rows.map((registro) => {
    const linha = {};
    for (const { campo_interno, nome_coluna } of mapeamento) {
      linha[nome_coluna] = resolverCampo(registro, campo_interno);
    }
    return linha;
  });
}

router.get('/estoque.xls', async (req, res) => {
  try {
    const linhas = await obterLinhasExportacao();
    if (!linhas) {
      return res.status(500).json({ erro: 'Nenhum mapeamento de exportação ativo configurado.' });
    }

    const planilha = XLSX.utils.json_to_sheet(linhas);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, 'Estoque');

    const buffer = XLSX.write(livro, { type: 'buffer', bookType: 'xls' });

    res.setHeader('Content-Disposition', 'attachment; filename="estoque.xls"');
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar XLS.', detalhe: err.message });
  }
});

router.get('/estoque.csv', async (req, res) => {
  try {
    const linhas = await obterLinhasExportacao();
    if (!linhas) {
      return res.status(500).json({ erro: 'Nenhum mapeamento de exportação ativo configurado.' });
    }

    const planilha = XLSX.utils.json_to_sheet(linhas);
    // BOM (\uFEFF) + ponto e vírgula (;) para abertura perfeita no Excel em português
    const csvContent = '\uFEFF' + XLSX.utils.sheet_to_csv(planilha, { FS: ';' });

    res.setHeader('Content-Disposition', 'attachment; filename="estoque.csv"');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(Buffer.from(csvContent, 'utf-8'));
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar CSV.', detalhe: err.message });
  }
});

// Visualizar / ajustar o layout de exportação sem tocar em código
router.get('/mapeamento', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM MapeamentoExportacao ORDER BY ordem');
  res.json(rows);
});

router.put('/mapeamento/:id', async (req, res) => {
  const { nome_coluna, ordem, ativo } = req.body;
  const { rows } = await pool.query(
    `UPDATE MapeamentoExportacao
     SET nome_coluna = COALESCE($1, nome_coluna),
         ordem = COALESCE($2, ordem),
         ativo = COALESCE($3, ativo)
     WHERE id = $4 RETURNING *`,
    [nome_coluna, ordem, ativo, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Mapeamento não encontrado.' });
  res.json(rows[0]);
});

module.exports = router;
