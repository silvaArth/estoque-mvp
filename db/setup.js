require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

  console.log('Aplicando schema...');
  await pool.query(schema);

  console.log('Aplicando seed (35 posições + mapeamento de exportação)...');
  await pool.query(seed);

  console.log('Banco pronto.');
  await pool.end();
}

run().catch((err) => {
  console.error('Erro ao configurar banco:', err);
  process.exit(1);
});
