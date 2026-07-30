const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool } = require('../src/db');

const filePath = 'C:/Users/arthu/.gemini/antigravity-ide/brain/84224528-9212-4911-a70b-b9030abdfdd8/.system_generated/steps/353/content.md';

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

async function importSpreadsheet() {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const headerIdx = lines.findIndex(l => l.trim().startsWith('CODIGO,DESCRIÇÃO,ENDEREÇO'));

  if (headerIdx === -1) {
    console.error('Cabeçalho CSV não encontrado!');
    process.exit(1);
  }

  const csvLines = lines.slice(headerIdx + 1);
  console.log(`Encontradas ${csvLines.length} linhas de dados.`);

  const itemsMap = new Map();
  const localizacoesMap = new Map();
  const movimentacoes = [];

  for (const line of csvLines) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);
    if (parts.length < 3) continue;

    let codigo = parts[0].replace(/^"|"$/g, '').trim();
    let descricao = parts[1].replace(/^"|"$/g, '').trim();
    let endereco = parts[2].replace(/^"|"$/g, '').trim();

    if (!codigo || !endereco) continue;

    if (!itemsMap.has(codigo)) {
      itemsMap.set(codigo, {
        sku: codigo,
        codigo_barras: codigo,
        descricao: descricao || codigo
      });
    }

    // Parse do endereço ex: RUA1-RACK-15-1-A -> rack: 15, coluna: 1, prateleira: A
    const endParts = endereco.split('-');
    let rack = 1;
    let coluna = 1;
    let prateleira = 'A';

    if (endParts.length >= 5) {
      rack = parseInt(endParts[2], 10) || 1;
      coluna = parseInt(endParts[3], 10) || 1;
      prateleira = endParts[4].toUpperCase();
    } else if (endParts.length === 3) {
      rack = parseInt(endParts[0], 10) || 1;
      coluna = parseInt(endParts[1], 10) || 1;
      prateleira = endParts[2].toUpperCase();
    }

    localizacoesMap.set(endereco, {
      armazem_id: 1,
      rack: rack,
      coluna: coluna,
      prateleira: prateleira,
      codigo_barras: endereco
    });

    movimentacoes.push({
      item_codigo: codigo,
      local_codigo: endereco
    });
  }

  console.log(`Itens a importar: ${itemsMap.size}`);
  console.log(`Localizações a importar: ${localizacoesMap.size}`);
  console.log(`Movimentações a registrar: ${movimentacoes.length}`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('1/4 Zerando tabelas existentes (Movimentacao, Item, Localizacao)...');
    await client.query('TRUNCATE TABLE Movimentacao RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE Item RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE Localizacao RESTART IDENTITY CASCADE');

    console.log('2/4 Inserindo novas localizações...');
    const locIdMap = new Map();
    for (const [cod, loc] of localizacoesMap.entries()) {
      const res = await client.query(
        `INSERT INTO Localizacao (armazem_id, rack, coluna, prateleira, codigo_barras)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [loc.armazem_id, loc.rack, loc.coluna, loc.prateleira, loc.codigo_barras]
      );
      locIdMap.set(cod, res.rows[0].id);
    }

    console.log('3/4 Inserindo novos itens...');
    const itemIdMap = new Map();
    for (const [cod, item] of itemsMap.entries()) {
      const res = await client.query(
        `INSERT INTO Item (sku, codigo_barras, descricao)
         VALUES ($1, $2, $3) RETURNING id`,
        [item.sku, item.codigo_barras, item.descricao]
      );
      itemIdMap.set(cod, res.rows[0].id);
    }

    console.log('4/4 Registrando movimentações de entrada para cada endereço...');
    for (const mov of movimentacoes) {
      const itemId = itemIdMap.get(mov.item_codigo);
      const locId = locIdMap.get(mov.local_codigo);

      await client.query(
        `INSERT INTO Movimentacao (item_id, localizacao_id, tipo, quantidade, operador)
         VALUES ($1, $2, 'entrada', 1, 'Importação Planilha')`,
        [itemId, locId]
      );
    }

    await client.query('COMMIT');
    console.log('✅ IMPORTAÇÃO E SUBSTITUIÇÃO CONCLUÍDAS COM SUCESSO!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro durante a importação:', err);
  } finally {
    client.release();
    pool.end();
  }
}

importSpreadsheet();
