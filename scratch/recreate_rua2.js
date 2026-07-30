require('dotenv').config();
const { pool } = require('../src/db');

async function recreateRua2() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Apagando posições antigas da RUA2...');
    await client.query("DELETE FROM Movimentacao WHERE localizacao_id IN (SELECT id FROM Localizacao WHERE rua = 'RUA2')");
    await client.query("DELETE FROM Localizacao WHERE rua = 'RUA2'");

    console.log('2. Criando RUA 2 com 1 Rack (Rack 1), 80 Colunas (1..80) e 5 Prateleiras (A..E)...');
    const prateleiras = ['A', 'B', 'C', 'D', 'E'];
    let inseridos = 0;

    for (let c = 1; c <= 80; c++) {
      for (const p of prateleiras) {
        const cod = `RUA2-RACK-1-${c}-${p}`;
        await client.query(
          `INSERT INTO Localizacao (armazem_id, rua, rack, coluna, prateleira, codigo_barras)
           VALUES (1, 'RUA2', 1, $1, $2, $3)`,
          [c, p, cod]
        );
        inseridos++;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Sucesso! Inseridas ${inseridos} posições para a RUA 2 (Rack 1, Colunas 1-80, Prateleiras A-E).`);

    const countRes = await client.query("SELECT COUNT(*) FROM Localizacao WHERE rua = 'RUA2'");
    console.log('Total de posições da RUA 2 no banco:', countRes.rows[0].count);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao recriar RUA 2:', err);
  } finally {
    client.release();
    pool.end();
  }
}

recreateRua2();
