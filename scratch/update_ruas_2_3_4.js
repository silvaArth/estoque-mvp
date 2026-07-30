require('dotenv').config();
const { pool } = require('../src/db');

async function updateRuas() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Atualizando RUA 2: trocando Rack 1 por Rack 2 e atualizando códigos de barras...');
    await client.query(`
      UPDATE Localizacao
      SET rack = 2,
          codigo_barras = REPLACE(codigo_barras, 'RUA2-RACK-1-', 'RUA2-RACK-2-')
      WHERE rua = 'RUA2' AND rack = 1
    `);

    console.log('2. Garantindo colunas 1 a 84 e prateleiras A-E para RUA 2 (Rack 2)...');
    const prateleirasRua2 = ['A', 'B', 'C', 'D', 'E'];
    for (let col = 1; col <= 84; col++) {
      for (const prat of prateleirasRua2) {
        const cod = `RUA2-RACK-2-${col}-${prat}`;
        await client.query(`
          INSERT INTO Localizacao (armazem_id, rua, rack, coluna, prateleira, codigo_barras, ativo)
          VALUES (1, 'RUA2', 2, $1, $2, $3, true)
          ON CONFLICT (codigo_barras) DO NOTHING
        `, [col, prat, cod]);
      }
    }

    console.log('3. Criando RUA 3 (Rack 1, colunas 1 a 84, prateleiras A-F)...');
    const prateleirasRua3 = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let col = 1; col <= 84; col++) {
      for (const prat of prateleirasRua3) {
        const cod = `RUA3-RACK-1-${col}-${prat}`;
        await client.query(`
          INSERT INTO Localizacao (armazem_id, rua, rack, coluna, prateleira, codigo_barras, ativo)
          VALUES (1, 'RUA3', 1, $1, $2, $3, true)
          ON CONFLICT (codigo_barras) DO NOTHING
        `, [col, prat, cod]);
      }
    }

    console.log('4. Criando RUA 4 (Rack 1, colunas 1 a 42, prateleiras A-F)...');
    const prateleirasRua4 = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let col = 1; col <= 42; col++) {
      for (const prat of prateleirasRua4) {
        const cod = `RUA4-RACK-1-${col}-${prat}`;
        await client.query(`
          INSERT INTO Localizacao (armazem_id, rua, rack, coluna, prateleira, codigo_barras, ativo)
          VALUES (1, 'RUA4', 1, $1, $2, $3, true)
          ON CONFLICT (codigo_barras) DO NOTHING
        `, [col, prat, cod]);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Migração das Ruas 2, 3 e 4 realizada com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração:', err);
  } finally {
    client.release();
    pool.end();
  }
}

updateRuas();
