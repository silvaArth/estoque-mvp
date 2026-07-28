-- Popula as 35 posições do rack único do MVP (colunas 1-7, prateleiras A-E)
DO $$
DECLARE
  c INT;
  p CHAR(1);
BEGIN
  FOR c IN 1..7 LOOP
    FOREACH p IN ARRAY ARRAY['A','B','C','D','E'] LOOP
      INSERT INTO Localizacao (armazem_id, rack, coluna, prateleira, codigo_barras)
      VALUES (1, 1, c, p, 'LOC-R1-C' || c || '-' || p)
      ON CONFLICT (armazem_id, rack, coluna, prateleira) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Mapeamento de exportação padrão (ajustável depois via API, sem mexer em código)
INSERT INTO MapeamentoExportacao (campo_interno, nome_coluna, ordem) VALUES
  ('localizacao.codigo_barras', 'Endereço', 1),
  ('item.sku', 'SKU', 2),
  ('item.descricao', 'Descrição', 3),
  ('quantidade', 'Quantidade', 4),
  ('tipo', 'Tipo Última Movimentação', 5),
  ('timestamp', 'Data/Hora', 6)
ON CONFLICT DO NOTHING;
