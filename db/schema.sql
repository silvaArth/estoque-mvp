-- Esquema do MVP de endereçamento de estoque
-- Modelo pensado para crescer (múltiplos armazéns/racks) sem reescrita.

CREATE TABLE IF NOT EXISTS Localizacao (
  id              SERIAL PRIMARY KEY,
  armazem_id      INT NOT NULL DEFAULT 1,
  rack            INT NOT NULL,
  coluna          INT NOT NULL,
  prateleira      CHAR(1) NOT NULL,
  codigo_barras   VARCHAR(50) UNIQUE NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (armazem_id, rack, coluna, prateleira)
);

CREATE TABLE IF NOT EXISTS Item (
  id              SERIAL PRIMARY KEY,
  sku             VARCHAR(50) UNIQUE NOT NULL,
  codigo_barras   VARCHAR(50) UNIQUE NOT NULL,
  descricao       VARCHAR(255) NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS Movimentacao (
  id              SERIAL PRIMARY KEY,
  item_id         INT NOT NULL REFERENCES Item(id),
  localizacao_id  INT NOT NULL REFERENCES Localizacao(id),
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida', 'transferencia')),
  quantidade      INT NOT NULL CHECK (quantidade > 0),
  operador        VARCHAR(100),
  timestamp       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mov_localizacao ON Movimentacao (localizacao_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mov_item ON Movimentacao (item_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS MapeamentoExportacao (
  id              SERIAL PRIMARY KEY,
  campo_interno   VARCHAR(100) NOT NULL,  -- ex: 'item.sku'
  nome_coluna     VARCHAR(100) NOT NULL,  -- ex: 'Código do Produto'
  ordem           INT NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT true
);

-- Estado atual = última movimentação registrada para cada localização.
-- Derivado do histórico, nunca editado diretamente.
CREATE OR REPLACE VIEW EstoqueAtual AS
SELECT DISTINCT ON (m.localizacao_id)
  m.localizacao_id,
  m.item_id,
  m.quantidade,
  m.tipo,
  m.timestamp
FROM Movimentacao m
ORDER BY m.localizacao_id, m.timestamp DESC;
