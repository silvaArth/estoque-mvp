# Endereçamento de Estoque — MVP (Rack 1)

## Pré-requisitos
- Node.js 18+
- PostgreSQL rodando localmente (ou acessível via URL de conexão)

## Como rodar

```bash
npm install
cp .env.example .env
# edite .env com sua DATABASE_URL real

npm run db:setup   # cria tabelas + popula as 35 posições (7 colunas x 5 prateleiras)
npm start          # sobe o servidor em http://localhost:3000
```

Abra `http://localhost:3000` no navegador.

## O que já funciona
- **Mapa do Rack**: visualização em grade das 35 posições, ocupadas/livres, clicável.
- **Movimentar**: formulário único que aceita tanto digitação manual quanto leitor
  de código de barras USB/Bluetooth (modo *keyboard wedge* — o leitor "digita" o
  código e aperta Enter, então funciona no mesmo campo sem nenhuma configuração
  extra).
- **Consultar**: "onde está o item X" e "o que tem na posição Y".
- **Exportar .xls**: gera a planilha usando o mapeamento configurável
  (`MapeamentoExportacao` no banco) — ajustar nomes/ordem de coluna não exige
  mexer em código, só em dados.

## Decisões em aberto (documentadas para a próxima fase)
- **Código não encontrado ao registrar movimentação**: hoje a API bloqueia com
  erro claro (`codigo_nao_encontrado`) indicando qual campo falhou. A estrutura
  já está pronta para, no futuro, oferecer cadastro rápido inline nesse ponto,
  caso isso seja confirmado como necessário.
- **Formato exato do .xls**: o gerador está pronto, mas o layout de colunas
  (`MapeamentoExportacao`) precisa ser confirmado contra o que a macro de
  importação dos outros sistemas realmente espera.
- **Semântica de "saída"**: uma movimentação do tipo `saida` marca a posição
  como livre novamente (usada como o fim de vida daquele item ali). Se no uso
  real "saída parcial" (tirar só uma parte da quantidade, mantendo o resto)
  for necessário, isso muda a lógica da view `EstoqueAtual` — hoje ela assume
  que a última movimentação sempre representa o estado final da posição.

## Expansão futura (múltiplos racks/armazéns)
O schema já suporta isso sem migração: `Localizacao.armazem_id` e `.rack` já
existem e estão fixos em `1` só porque o MVP tem um rack só. Adicionar um novo
armazém ou rack é inserir linhas novas em `Localizacao`, não alterar estrutura.
