const API = '';

// ---------- Popup de Confirmação Customizado ----------
function pedirConfirmacao({
  titulo = 'Confirmação',
  mensagem = 'Tem certeza que deseja realizar esta ação?',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  tipo = 'perigo',
  icone = '⚠️'
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirmacao');
    const elTitulo = document.getElementById('confirm-titulo');
    const elMensagem = document.getElementById('confirm-mensagem');
    const elIcone = document.getElementById('confirm-icone');
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancelar = document.getElementById('btn-confirm-cancelar');

    if (!modal) {
      resolve(window.confirm(mensagem));
      return;
    }

    elTitulo.textContent = titulo;
    elMensagem.textContent = mensagem;
    elIcone.textContent = icone;
    btnOk.textContent = textoConfirmar;
    btnCancelar.textContent = textoCancelar;

    if (tipo === 'perigo') {
      btnOk.className = 'btn-perigo';
    } else {
      btnOk.className = 'btn-primario';
    }

    modal.classList.remove('oculto');

    const fechar = (valor) => {
      modal.classList.add('oculto');
      btnOk.removeEventListener('click', handlerOk);
      btnCancelar.removeEventListener('click', handlerCancel);
      resolve(valor);
    };

    const handlerOk = () => fechar(true);
    const handlerCancel = () => fechar(false);

    btnOk.addEventListener('click', handlerOk);
    btnCancelar.addEventListener('click', handlerCancel);
  });
}

// ---------- Notificações Toast Flutuantes ----------
function mostrarToast(mensagem, tipo = 'sucesso', duracao = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const icone = tipo === 'sucesso' ? '✅' : tipo === 'erro' ? '❌' : 'ℹ️';
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<span class="toast-icone">${icone}</span> <span class="toast-msg">${mensagem}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-saindo');
    setTimeout(() => toast.remove(), 250);
  }, duracao);
}

// ---------- Navegação entre abas ----------
document.querySelectorAll('.aba').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.aba').forEach((b) => b.classList.remove('ativa'));
    document.querySelectorAll('.painel').forEach((p) => p.classList.remove('painel-ativo'));
    btn.classList.add('ativa');
    document.getElementById('painel-' + btn.dataset.aba).classList.add('painel-ativo');
    if (btn.dataset.aba === 'mapa') {
      const ruaAtual = document.getElementById('select-rua').value;
      const rackAtual = document.getElementById('select-rack').value;
      if (ruaAtual && rackAtual) carregarMapa(ruaAtual, rackAtual);
    }
  });
});

// ---------- Gerenciamento e Mapa de Ruas e Racks ----------
async function carregarRuas() {
  const selectRua = document.getElementById('select-rua');
  const selectRack = document.getElementById('select-rack');

  try {
    const resp = await fetch(`${API}/localizacoes/ruas`);
    const ruas = await resp.json();

    if (!resp.ok || !Array.isArray(ruas) || !ruas.length) {
      selectRua.innerHTML = '<option value="">Sem Ruas</option>';
      return;
    }

    selectRua.innerHTML = ruas
      .map((r) => `<option value="${r}">Rua ${r.replace(/^RUA/i, '')}</option>`)
      .join('');

    selectRua.addEventListener('change', () => {
      carregarRacks(selectRua.value);
    });

    // Configura evento do select de Rack
    selectRack.addEventListener('change', () => {
      carregarMapa(selectRua.value, selectRack.value);
    });

    // Carrega racks da primeira rua
    await carregarRacks(ruas[0]);
  } catch (err) {
    selectRua.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

async function carregarRacks(rua) {
  const selectRack = document.getElementById('select-rack');
  if (!rua) return;

  try {
    const resp = await fetch(`${API}/localizacoes/racks?rua=${encodeURIComponent(rua)}`);
    const racks = await resp.json();

    if (!resp.ok || !Array.isArray(racks) || !racks.length) {
      selectRack.innerHTML = '<option value="">Sem Racks</option>';
      document.getElementById('grade-rack').innerHTML = '';
      return;
    }

    selectRack.innerHTML = racks
      .map((r) => `<option value="${r}">Rack ${String(r).padStart(2, '0')}</option>`)
      .join('');

    // Carrega o mapa para o primeiro rack da rua selecionada
    carregarMapa(rua, racks[0]);
  } catch (err) {
    selectRack.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

async function carregarMapa(rua, rackNum) {
  const grade = document.getElementById('grade-rack');
  if (!rackNum || !rua) return;

  try {
    const resp = await fetch(`${API}/estoque/mapa/${rackNum}?rua=${encodeURIComponent(rua)}`);
    const vagas = await resp.json();

    if (!resp.ok || !Array.isArray(vagas)) {
      grade.innerHTML = `<div style="grid-column: 1 / -1; padding: 16px; color: var(--saida); background: #fdf2f2; border: 1px solid var(--saida); border-radius: 4px;">
        Erro ao carregar o estoque: ${vagas.detalhe || vagas.erro || 'Não foi possível conectar ao banco de dados.'}
      </div>`;
      return;
    }

    // Identifica colunas e prateleiras dinamicamente presentes neste Rack
    const colunas = [...new Set(vagas.map((v) => v.coluna))].sort((a, b) => a - b);
    const prateleiras = [...new Set(vagas.map((v) => v.prateleira))].sort();

    // Inverte a visualização: Prateleiras no topo (X) e Colunas nas linhas (Y) para caber na tela
    grade.style.gridTemplateColumns = `36px repeat(${prateleiras.length || 1}, 1fr)`;
    grade.innerHTML = '';
    grade.appendChild(document.createElement('div')); // canto superior esquerdo vazio

    // Cabeçalhos superiores: Prateleiras (A, B, C, D, E)
    prateleiras.forEach((p) => {
      const rot = document.createElement('div');
      rot.className = 'rotulo-coluna';
      rot.textContent = 'Prat. ' + p;
      grade.appendChild(rot);
    });

    // Linhas: Colunas (C1, C2, C3 ... C80)
    colunas.forEach((c) => {
      const rot = document.createElement('div');
      rot.className = 'rotulo-prateleira';
      rot.textContent = 'C' + c;
      grade.appendChild(rot);

      prateleiras.forEach((prateleira) => {
        const vaga = vagas.find((v) => v.coluna === c && v.prateleira === prateleira);
        const el = document.createElement('div');
        el.className = 'vaga' + (vaga && vaga.ocupada ? ' ocupada' : '');
        if (vaga && vaga.ocupada) {
          el.title = `${vaga.item_codigo_barras || ''} — ${vaga.descricao || ''}`;
          el.innerHTML = `<span class="vaga-desc">${vaga.item_codigo_barras || ''} — ${vaga.descricao || ''}</span>`;
        } else if (vaga) {
          el.title = `Vaga livre (${vaga.codigo_barras})`;
          el.textContent = '';
        } else {
          el.style.opacity = '0.3';
        }
        if (vaga) {
          el.addEventListener('click', () => mostrarDetalheVaga(vaga));
        }
        grade.appendChild(el);
      });
    });
  } catch (err) {
    grade.innerHTML = `<div style="grid-column: 1 / -1; padding: 16px; color: var(--saida); background: #fdf2f2; border: 1px solid var(--saida); border-radius: 4px;">
      Erro de conexão com o servidor.
    </div>`;
  }
}

function mostrarDetalheVaga(vaga) {
  const modal = document.getElementById('modal-vaga');
  const conteudo = document.getElementById('modal-conteudo');
  if (!vaga) return;

  if (vaga.ocupada) {
    conteudo.innerHTML = `
      <div class="modal-conteudo-vaga">
        <div>
          <span class="modal-badge ocupada">&#9679; Vaga Ocupada</span>
        </div>
        <hr class="modal-sep">
        <div class="modal-linha">
          <span class="modal-rotulo">Posição</span>
          <span class="modal-valor">${vaga.codigo_barras}</span>
        </div>
        <div class="modal-linha">
          <span class="modal-rotulo">Cód. de Barras</span>
          <span class="modal-valor">${vaga.item_codigo_barras || '—'}</span>
        </div>
        <div class="modal-linha">
          <span class="modal-rotulo">Descrição</span>
          <span class="modal-valor">${vaga.descricao || '—'}</span>
        </div>
        <div class="modal-linha">
          <span class="modal-rotulo">Quantidade</span>
          <span class="modal-valor">${vaga.quantidade ?? 1}</span>
        </div>
        <hr class="modal-sep">
        <button type="button" id="btn-modal-remover-posicao" class="btn-perigo" style="padding: 10px 14px; font-size: 13px; font-weight: 600; width: 100%;">
          📦 Remover Produto desta Posição
        </button>
      </div>`;

    setTimeout(() => {
      document.getElementById('btn-modal-remover-posicao')?.addEventListener('click', async () => {
        const confirmado = await pedirConfirmacao({
          titulo: 'Remover da Posição',
          mensagem: `Deseja remover o produto "${vaga.descricao || vaga.item_codigo_barras}" da posição ${vaga.codigo_barras}?`,
          textoConfirmar: 'Sim, Remover',
          textoCancelar: 'Cancelar',
          tipo: 'perigo',
          icone: '📦'
        });
        if (!confirmado) return;
        try {
          const resp = await fetch(`${API}/movimentacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_codigo_barras: vaga.item_codigo_barras,
              localizacao_codigo_barras: vaga.codigo_barras,
              tipo: 'saida',
              quantidade: vaga.quantidade || 1,
              operador: 'Remoção via Mapa',
            }),
          });
          const dados = await resp.json();
          if (!resp.ok) {
            mostrarToast(dados.erro || dados.mensagem || 'Erro ao remover produto da posição.', 'erro');
            return;
          }
          mostrarToast(`Produto removido da posição ${vaga.codigo_barras} com sucesso!`, 'sucesso');
          document.getElementById('modal-vaga')?.classList.add('oculto');
          const ruaAtual = document.getElementById('select-rua')?.value;
          const rackAtual = document.getElementById('select-rack')?.value;
          if (ruaAtual && rackAtual) carregarMapa(ruaAtual, rackAtual);
        } catch (err) {
          mostrarToast('Erro ao conectar com o servidor para registrar a remoção.', 'erro');
        }
      });
    }, 50);
  } else {
    conteudo.innerHTML = `
      <div class="modal-conteudo-vaga">
        <div>
          <span class="modal-badge livre">&#9675; Vaga Livre</span>
        </div>
        <hr class="modal-sep">
        <div class="modal-linha">
          <span class="modal-rotulo">Posição</span>
          <span class="modal-valor">${vaga.codigo_barras}</span>
        </div>
      </div>`;
  }

  modal.classList.remove('oculto');
}

// Fechar modal ao clicar no X ou no overlay
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modal-vaga');
  document.getElementById('modal-fechar').addEventListener('click', () => modal.classList.add('oculto'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('oculto'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.classList.add('oculto'); });
});

// ---------- Movimentação ----------
const inputItem = document.getElementById('input-item');
const inputLocalizacao = document.getElementById('input-localizacao');

// Enter no campo de item avança pro campo de localização - funciona igual
// para digitação manual e para leitor de código de barras (modo keyboard wedge).
inputItem.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    inputLocalizacao.focus();
  }
});

document.getElementById('form-movimentacao').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('feedback-movimentacao');
  feedback.textContent = '';
  feedback.className = 'feedback';

  const corpo = {
    item_codigo_barras: inputItem.value.trim(),
    localizacao_codigo_barras: inputLocalizacao.value.trim(),
    tipo: document.getElementById('input-tipo').value,
    quantidade: Number(document.getElementById('input-quantidade').value) || 1,
    operador: document.getElementById('input-operador').value.trim(),
  };

  try {
    const resp = await fetch(`${API}/movimentacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const dados = await resp.json();

    if (!resp.ok) {
      if (dados.campo === 'item_codigo_barras') {
        const codEscaneado = inputItem.value.trim();
        feedback.innerHTML = `Produto não encontrado. <button type="button" id="btn-ir-cadastrar" style="background:none; border:none; color:var(--amarelo-escuro); text-decoration:underline; font-weight:600; cursor:pointer; font-family:inherit;">Clique aqui para cadastrá-lo</button>`;
        feedback.className = 'feedback erro';
        document.getElementById('btn-ir-cadastrar')?.addEventListener('click', () => {
          document.querySelectorAll('.aba').forEach((b) => b.classList.remove('ativa'));
          document.querySelectorAll('.painel').forEach((p) => p.classList.remove('painel-ativo'));
          const abaCad = document.querySelector('[data-aba="cadastrar"]');
          abaCad?.classList.add('ativa');
          document.getElementById('painel-cadastrar')?.classList.add('painel-ativo');
          const inputCadCod = document.getElementById('input-cad-codigo');
          if (inputCadCod) {
            inputCadCod.value = codEscaneado;
            document.getElementById('input-cad-descricao')?.focus();
          }
        });
      } else {
        feedback.textContent = dados.mensagem || dados.erro || 'Erro ao registrar movimentação.';
        feedback.className = 'feedback erro';
      }
      return;
    }

    feedback.textContent = 'Movimentação registrada com sucesso.';
    feedback.className = 'feedback sucesso';
    e.target.reset();
    document.getElementById('input-quantidade').value = 1;
    inputItem.focus();

    // Recarrega o mapa do rack atual para refletir a nova posição no mapa
    const ruaAtual = document.getElementById('select-rua')?.value;
    const rackAtual = document.getElementById('select-rack')?.value;
    if (ruaAtual && rackAtual) {
      carregarMapa(ruaAtual, rackAtual);
    }
  } catch (err) {
    feedback.textContent = 'Erro ao se comunicar com o servidor. Verifique se o servidor backend está rodando com npm start.';
    feedback.className = 'feedback erro';
  }
});

// ---------- Cadastro de Produtos ----------
document.getElementById('form-cadastro-item').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('feedback-cadastro');
  feedback.textContent = '';
  feedback.className = 'feedback';

  const codigo = document.getElementById('input-cad-codigo').value.trim();
  const descricao = document.getElementById('input-cad-descricao').value.trim();

  try {
    const resp = await fetch(`${API}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_barras: codigo, descricao }),
    });

    const dados = await resp.json();

    if (!resp.ok) {
      feedback.textContent = dados.mensagem || dados.erro || 'Erro ao cadastrar produto.';
      feedback.className = 'feedback erro';
      return;
    }

    feedback.textContent = `Produto "${dados.descricao}" (${dados.codigo_barras}) cadastrado com sucesso!`;
    feedback.className = 'feedback sucesso';
    e.target.reset();
    document.getElementById('input-cad-codigo').focus();
  } catch (err) {
    feedback.textContent = 'Erro de conexão com o servidor ao cadastrar produto.';
    feedback.className = 'feedback erro';
  }
});

// Excluir Produto pelo formulário
document.getElementById('form-excluir-item').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('feedback-exclusao');
  feedback.textContent = '';
  feedback.className = 'feedback';

  const codigo = document.getElementById('input-exc-codigo').value.trim();

  const confirmado = await pedirConfirmacao({
    titulo: 'Excluir Produto',
    mensagem: `Tem certeza que deseja excluir o produto "${codigo}" e seus registros permanentemente do cadastro?`,
    textoConfirmar: 'Sim, Excluir',
    textoCancelar: 'Cancelar',
    tipo: 'perigo',
    icone: '🗑'
  });
  if (!confirmado) return;

  try {
    const resp = await fetch(`${API}/itens/${encodeURIComponent(codigo)}`, {
      method: 'DELETE',
    });

    const dados = await resp.json();

    if (!resp.ok) {
      feedback.textContent = dados.erro || 'Erro ao excluir produto.';
      feedback.className = 'feedback erro';
      return;
    }

    feedback.textContent = dados.mensagem || 'Produto excluído com sucesso!';
    feedback.className = 'feedback sucesso';
    e.target.reset();

    // Recarrega o mapa se estiver visível
    const ruaAtual = document.getElementById('select-rua')?.value;
    const rackAtual = document.getElementById('select-rack')?.value;
    if (ruaAtual && rackAtual) carregarMapa(ruaAtual, rackAtual);
  } catch (err) {
    feedback.textContent = 'Erro de conexão ao tentar excluir o produto.';
    feedback.className = 'feedback erro';
  }
});

// ---------- Importar Planilha (Modal) ----------
(function () {
  const btnAbrir = document.getElementById('btn-abrir-modal-importar');
  const modal = document.getElementById('modal-importar');
  const btnFechar = document.getElementById('modal-importar-fechar');
  const dropZone = document.getElementById('drop-zone-planilha');
  const fileInput = document.getElementById('input-arquivo-planilha');
  const btnImportar = document.getElementById('btn-importar-planilha');
  const chkSubstituir = document.getElementById('chk-substituir-produtos');
  const nomeArquivo = document.getElementById('nome-arquivo-planilha');
  const feedback = document.getElementById('feedback-importacao');

  if (!btnAbrir || !modal) return;

  // Abrir modal
  btnAbrir.addEventListener('click', () => {
    modal.classList.remove('oculto');
    feedback.textContent = '';
    feedback.className = 'feedback';
  });

  // Fechar modal
  const fecharModal = () => modal.classList.add('oculto');
  btnFechar?.addEventListener('click', fecharModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

  // Clique no drop-zone abre seletor de arquivo
  dropZone?.addEventListener('click', () => fileInput.click());

  // Drag & drop
  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone?.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropZone?.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });
  dropZone?.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      fileInput.files = files;
      atualizarArquivo();
    }
  });

  function atualizarArquivo() {
    const file = fileInput.files?.[0];
    if (file) {
      nomeArquivo.textContent = `📄 ${file.name}`;
      btnImportar.disabled = false;
    } else {
      nomeArquivo.textContent = '';
      btnImportar.disabled = true;
    }
    feedback.textContent = '';
    feedback.className = 'feedback';
  }

  fileInput?.addEventListener('change', atualizarArquivo);

  async function processarPlanilha(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          const normKey = (k) => String(k || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

          const itens = jsonRows.map((row) => {
            let codigo = '', descricao = '';
            for (const [key, val] of Object.entries(row)) {
              const k = normKey(key);
              const v = String(val ?? '').trim();
              if (!v) continue;
              if (['codigo', 'cod', 'codigo_barras', 'codigobarras', 'ean', 'barcode', 'item'].includes(k) && !codigo) codigo = v;
              else if (['descricao', 'descricao_item', 'produto', 'nome', 'desc'].includes(k) && !descricao) descricao = v;
            }
            if (!codigo || !descricao) {
              const vals = Object.values(row).map((v) => String(v ?? '').trim()).filter(Boolean);
              if (!codigo && vals[0]) codigo = vals[0];
              if (!descricao && vals[1]) descricao = vals[1];
            }
            return { codigo_barras: codigo, descricao: descricao || codigo };
          }).filter((item) => item.codigo_barras);

          resolve(itens);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Baixar modelo de planilha (.xlsx) - apenas cabeçalho
  document.getElementById('btn-baixar-modelo')?.addEventListener('click', () => {
    try {
      const ws = XLSX.utils.aoa_to_sheet([['codigo_barras', 'descricao']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
      XLSX.writeFile(wb, 'modelo_importacao_produtos.xlsx');
      mostrarToast('Modelo de planilha baixado!', 'sucesso');
    } catch (err) {
      mostrarToast('Erro ao gerar o modelo de planilha.', 'erro');
    }
  });

  btnImportar?.addEventListener('click', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    btnImportar.disabled = true;
    btnImportar.textContent = 'Processando...';
    feedback.textContent = 'Lendo planilha...';
    feedback.className = 'feedback';

    try {
      const itens = await processarPlanilha(file);

      if (!itens.length) {
        feedback.textContent = 'Nenhum produto válido encontrado na planilha.';
        feedback.className = 'feedback erro';
        mostrarToast('Nenhum produto válido encontrado na planilha.', 'erro');
        btnImportar.disabled = false;
        btnImportar.textContent = 'Processar e Importar';
        return;
      }

      feedback.textContent = `Enviando ${itens.length} produto(s)...`;

      const resp = await fetch(`${API}/itens/importar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens }),
      });

      const dados = await resp.json();

      if (!resp.ok) {
        feedback.textContent = dados.erro || 'Erro ao importar.';
        feedback.className = 'feedback erro';
        mostrarToast(dados.erro || 'Erro ao importar produtos.', 'erro');
      } else {
        const msgSucesso = dados.mensagem || `${itens.length} produto(s) importados com sucesso!`;
        feedback.textContent = msgSucesso;
        feedback.className = 'feedback sucesso';
        mostrarToast(msgSucesso, 'sucesso');
        fileInput.value = '';
        nomeArquivo.textContent = '';
        const ruaAtual = document.getElementById('select-rua')?.value;
        const rackAtual = document.getElementById('select-rack')?.value;
        if (ruaAtual && rackAtual) carregarMapa(ruaAtual, rackAtual);
      }
    } catch (err) {
      feedback.textContent = 'Erro ao processar o arquivo.';
      feedback.className = 'feedback erro';
      mostrarToast('Erro ao processar a planilha.', 'erro');
    } finally {
      btnImportar.disabled = false;
      btnImportar.textContent = 'Processar e Importar';
    }
  });
})();

// ---------- Importar Planilha com Posição (Modal) ----------
(function () {
  const btnAbrir = document.getElementById('btn-abrir-modal-importar-posicao');
  const modal = document.getElementById('modal-importar-posicao');
  const btnFechar = document.getElementById('modal-importar-posicao-fechar');
  const dropZone = document.getElementById('drop-zone-planilha-posicao');
  const fileInput = document.getElementById('input-arquivo-planilha-posicao');
  const btnImportar = document.getElementById('btn-importar-planilha-posicao');
  const nomeArquivo = document.getElementById('nome-arquivo-planilha-posicao');
  const feedback = document.getElementById('feedback-importacao-posicao');

  if (!btnAbrir || !modal) return;

  // Abrir modal
  btnAbrir.addEventListener('click', () => {
    modal.classList.remove('oculto');
    feedback.textContent = '';
    feedback.className = 'feedback';
  });

  // Fechar modal
  const fecharModal = () => modal.classList.add('oculto');
  btnFechar?.addEventListener('click', fecharModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

  // Clique no drop-zone abre seletor de arquivo
  dropZone?.addEventListener('click', () => fileInput.click());

  // Drag & drop
  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone?.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropZone?.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });
  dropZone?.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      fileInput.files = files;
      atualizarArquivo();
    }
  });

  function atualizarArquivo() {
    const file = fileInput.files?.[0];
    if (file) {
      nomeArquivo.textContent = `📄 ${file.name}`;
      btnImportar.disabled = false;
    } else {
      nomeArquivo.textContent = '';
      btnImportar.disabled = true;
    }
    feedback.textContent = '';
    feedback.className = 'feedback';
  }

  fileInput?.addEventListener('change', atualizarArquivo);

  async function processarPlanilhaComPosicao(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          const normKey = (k) => String(k || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

          const itens = jsonRows.map((row) => {
            let codigo = '', descricao = '', posicao = '', quantidade = 1;
            for (const [key, val] of Object.entries(row)) {
              const k = normKey(key);
              const v = String(val ?? '').trim();
              if (!v) continue;
              if (['codigo', 'cod', 'codigo_barras', 'codigobarras', 'ean', 'barcode', 'item'].includes(k) && !codigo) codigo = v;
              else if (['descricao', 'descricao_item', 'produto', 'nome', 'desc'].includes(k) && !descricao) descricao = v;
              else if (['posicao', 'localizacao', 'pos', 'local', 'endereco'].includes(k) && !posicao) posicao = v;
              else if (['quantidade', 'qtd', 'quant'].includes(k)) quantidade = Number(v) || 1;
            }
            if (!codigo || !descricao) {
              const vals = Object.values(row).map((v) => String(v ?? '').trim()).filter(Boolean);
              if (!codigo && vals[0]) codigo = vals[0];
              if (!descricao && vals[1]) descricao = vals[1];
            }
            return { codigo_barras: codigo, descricao: descricao || codigo, posicao, quantidade };
          }).filter((item) => item.codigo_barras);

          resolve(itens);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Baixar modelo de planilha com posição (.xlsx)
  document.getElementById('btn-baixar-modelo-posicao')?.addEventListener('click', () => {
    try {
      const ws = XLSX.utils.aoa_to_sheet([['codigo_barras', 'descricao', 'posicao', 'quantidade'], ['7891234567890', 'Produto Exemplo', 'RUA1-RACK-2-1-A', 1]]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
      XLSX.writeFile(wb, 'modelo_importacao_com_posicao.xlsx');
      mostrarToast('Modelo de planilha com posição baixado!', 'sucesso');
    } catch (err) {
      mostrarToast('Erro ao gerar o modelo de planilha com posição.', 'erro');
    }
  });

  btnImportar?.addEventListener('click', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    btnImportar.disabled = true;
    btnImportar.textContent = 'Processando...';
    feedback.textContent = 'Lendo planilha...';
    feedback.className = 'feedback';

    try {
      const itens = await processarPlanilhaComPosicao(file);

      if (!itens.length) {
        feedback.textContent = 'Nenhum produto válido encontrado na planilha.';
        feedback.className = 'feedback erro';
        mostrarToast('Nenhum produto válido encontrado na planilha.', 'erro');
        btnImportar.disabled = false;
        btnImportar.textContent = 'Processar e Importar com Posição';
        return;
      }

      feedback.textContent = `Enviando ${itens.length} produto(s)...`;

      const resp = await fetch(`${API}/itens/importar-com-posicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens }),
      });

      const dados = await resp.json();

      if (!resp.ok) {
        feedback.textContent = dados.erro || 'Erro ao importar com posição.';
        feedback.className = 'feedback erro';
        mostrarToast(dados.erro || 'Erro ao importar produtos com posição.', 'erro');
      } else {
        const msgSucesso = dados.mensagem || `${itens.length} produto(s) importados com sucesso!`;
        feedback.textContent = msgSucesso;
        feedback.className = 'feedback sucesso';
        mostrarToast(msgSucesso, 'sucesso');
        fileInput.value = '';
        nomeArquivo.textContent = '';
        const ruaAtual = document.getElementById('select-rua')?.value;
        const rackAtual = document.getElementById('select-rack')?.value;
        if (ruaAtual && rackAtual) carregarMapa(ruaAtual, rackAtual);
      }
    } catch (err) {
      feedback.textContent = 'Erro ao processar o arquivo.';
      feedback.className = 'feedback erro';
      mostrarToast('Erro ao processar a planilha.', 'erro');
    } finally {
      btnImportar.disabled = false;
      btnImportar.textContent = 'Processar e Importar com Posição';
    }
  });
})();

// ---------- Consulta ----------
document.getElementById('form-consulta-item').addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = document.getElementById('input-consulta-item').value.trim();
  const resultado = document.getElementById('resultado-consulta-item');
  if (!codigo) {
    resultado.innerHTML = '<div class="res-card res-alerta">⚠️ Por favor, informe um código para buscar.</div>';
    return;
  }
  resultado.innerHTML = '<div class="res-card res-carregando">⏳ Buscando informações...</div>';
  try {
    const resp = await fetch(`${API}/estoque/item/${encodeURIComponent(codigo)}`);
    const dados = await resp.json();

    if (!resp.ok && dados.erro === 'produto_nao_cadastrado') {
      resultado.innerHTML = `<div class="res-card res-erro">⚠️ ${dados.mensagem || 'Produto não encontrado no cadastro.'}</div>`;
      return;
    }

    if (dados.existe) {
      if (dados.posicoes && dados.posicoes.length) {
        resultado.innerHTML = `
          <div style="margin-bottom: 6px; font-weight: 600; font-size: 13px; color: var(--tinta);">${dados.produto.descricao}</div>
        ` + dados.posicoes.map((d) => `
          <div class="res-card res-sucesso">
            <div class="res-header">
              <span class="res-badge pos">📍 ${d.localizacao_codigo_barras}</span>
              <span class="res-badge qtd">Qtd: ${d.quantidade}</span>
            </div>
            <div class="res-detalhe">
              <span class="res-sub">Rack: ${d.rack} | Coluna: ${d.coluna} | Prat: ${d.prateleira}</span>
            </div>
          </div>
        `).join('');
      } else {
        resultado.innerHTML = `
          <div class="res-card res-vazio">
            <div style="font-weight: 600; font-size: 13px; color: var(--tinta);">${dados.produto.descricao}</div>
            <div class="res-sub" style="margin-top: 4px;">📦 Produto cadastrado, mas sem estoque/posição no momento.</div>
          </div>
        `;
      }
    } else {
      resultado.innerHTML = `<div class="res-card res-erro">⚠️ Produto "${codigo}" não encontrado no sistema.</div>`;
    }
  } catch (err) {
    resultado.innerHTML = '<div class="res-card res-erro">❌ Erro ao conectar com o servidor.</div>';
  }
});

document.getElementById('form-consulta-local').addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = document.getElementById('input-consulta-local').value.trim();
  const resultado = document.getElementById('resultado-consulta-local');
  if (!codigo) {
    resultado.innerHTML = '<div class="res-card res-alerta">⚠️ Por favor, informe a posição para buscar.</div>';
    return;
  }
  resultado.innerHTML = '<div class="res-card res-carregando">⏳ Buscando informações...</div>';
  try {
    const resp = await fetch(`${API}/estoque/localizacao/${encodeURIComponent(codigo)}`);
    const dados = await resp.json();

    if (!resp.ok && dados.erro === 'posicao_nao_cadastrada') {
      resultado.innerHTML = `<div class="res-card res-erro">⚠️ ${dados.mensagem || 'Posição não cadastrada no sistema.'}</div>`;
      return;
    }

    if (dados.ocupada) {
      resultado.innerHTML = `
        <div class="res-card res-sucesso">
          <div class="res-header">
            <span class="res-badge ocupada">🔴 VAGA OCUPADA</span>
            <span class="res-badge qtd">Qtd: ${dados.quantidade}</span>
          </div>
          <div class="res-body">
            <div class="res-titulo-item">${dados.descricao || 'Sem descrição'}</div>
            <div class="res-sub">Cód: ${dados.codigo_barras || '—'}</div>
          </div>
        </div>
      `;
    } else if (dados.existe) {
      resultado.innerHTML = `
        <div class="res-card res-livre">
          <div class="res-header">
            <span class="res-badge livre">🟢 VAGA LIVRE</span>
          </div>
          <div class="res-sub" style="margin-top: 4px;">Esta posição (${dados.localizacao.codigo_barras}) existe e está disponível para armazenamento.</div>
        </div>
      `;
    } else {
      resultado.innerHTML = `<div class="res-card res-erro">⚠️ Posição "${codigo}" não encontrada no sistema.</div>`;
    }
  } catch (err) {
    resultado.innerHTML = '<div class="res-card res-erro">❌ Erro ao conectar com o servidor.</div>';
  }
});

// ---------- Exportação ----------
document.getElementById('btn-exportar-xls')?.addEventListener('click', () => {
  window.location.href = `${API}/export/estoque.xls`;
});

document.getElementById('btn-exportar-csv')?.addEventListener('click', () => {
  window.location.href = `${API}/export/estoque.csv`;
});

// Carrega as ruas, racks e o mapa ao abrir a página (aba padrão)
carregarRuas();
