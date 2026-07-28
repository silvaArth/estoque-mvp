require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const localizacoesRouter = require('./src/routes/localizacoes');
const itensRouter = require('./src/routes/itens');
const movimentacoesRouter = require('./src/routes/movimentacoes');
const estoqueRouter = require('./src/routes/estoque');
const exportRouter = require('./src/routes/export');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/localizacoes', localizacoesRouter);
app.use('/itens', itensRouter);
app.use('/movimentacoes', movimentacoesRouter);
app.use('/estoque', estoqueRouter);
app.use('/export', exportRouter);

// tratamento de erro simples, centralizado
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno.', detalhe: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
