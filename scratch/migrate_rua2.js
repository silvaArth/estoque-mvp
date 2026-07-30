require('dotenv').config();
const { pool } = require('../src/db');

async function migrateAndCreateRua2() {
  try {
    console.log('1. Adicionando coluna "rua" na tabela Localizacao (se não existir)...');
    await pool.query(`ALTER TABLE Localizacao ADD COLUMN IF NOT EXISTS rua VARCHAR(20) NOT NULL DEFAULT 'RUA1'`);

    console.log('2. Atualizando campo "rua" das localizações existentes a partir do codigo_barras...');
    await pool.query(`UPDATE Localizacao SET rua = UPPER(SPLIT_PART(codigo_barras, '-', 1)) WHERE codigo_barras LIKE 'RUA%'`);

    console.log('3. Removendo constraint UNIQUE antiga de (armazem_id, rack, coluna, prateleira)...');
    await pool.query(`ALTER TABLE Localizacao DROP CONSTRAINT IF EXISTS localizacao_armazem_id_rack_coluna_prateleira_key`);

    console.log('4. Adicionando nova constraint UNIQUE incluindo (armazem_id, rua, rack, coluna, prateleira)...');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'localizacao_armazem_rua_rack_col_prat_key'
        ) THEN
          ALTER TABLE Localizacao ADD CONSTRAINT localizacao_armazem_rua_rack_col_prat_key UNIQUE (armazem_id, rua, rack, coluna, prateleira);
        END IF;
      END $$;
    `);

    console.log('5. Criando posições para a RUA 2...');
    // Criando RUA2 com Racks 1..5, cada um com 7 colunas (1..7) e 5 prateleiras (A..E) -> 35 vagas por rack = 175 vagas livres
    const prateleiras = ['A', 'B', 'C', 'D', 'E'];
    const racksRua2 = [1, 2, 3, 4, 5];
    let inseridos = 0;

    for (const rack of racksRua2) {
      for (let c = 1; c <= 7; c++) {
        for (const p of prateleiras) {
          const cod = `RUA2-RACK-${rack}-${c}-${p}`;
          const res = await pool.query(
            `INSERT INTO Localizacao (armazem_id, rua, rack, coluna, prateleira, codigo_barras)
             VALUES (1, 'RUA2', $1, $2, $3, $4)
             ON CONFLICT (codigo_barras) DO NOTHING`,
            [rack, c, p, cod]
          );
          if (res.rowCount > 0) inseridos++;
        }
      }
    }

    console.log(`Inseridas ${inseridos} novas posições para RUA 2!`);

    const ruax = await pool.query(`SELECT DISTINCT rua FROM Localizacao ORDER BY rua`);
    console.log('Ruas no banco de dados:', ruax.rows.map(r => r.rua));

  } catch (err) {
    console.error('Erro ao migrar/criar Rua 2:', err);
  } finally {
    pool.end();
  }
}

migrateAndCreateRua2();
