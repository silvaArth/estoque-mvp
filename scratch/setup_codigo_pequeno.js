require('dotenv').config();
const { pool } = require('../src/db');

async function setup() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Apagando movimentações e produtos...');
    await client.query('DELETE FROM movimentacao');
    await client.query('DELETE FROM item');

    console.log('2. Adicionando coluna "codigo_pequeno" na tabela Item...');
    await client.query('ALTER TABLE item ADD COLUMN IF NOT EXISTS codigo_pequeno VARCHAR(50)');

    console.log('3. Criando índice para busca rápida por codigo_pequeno...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_item_codigo_pequeno ON item(codigo_pequeno)');

    await client.query('COMMIT');
    console.log('✅ Banco de dados zerado e coluna "codigo_pequeno" criada com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro no setup:', err);
  } finally {
    client.release();
    pool.end();
  }
}

setup();
