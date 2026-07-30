const API = '';

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
  const painelDetalhe = document.getElementById('detalhe-vaga');
  painelDetalhe.classList.add('oculto');

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
  const painel = document.getElementById('detalhe-vaga');
  if (!vaga) return;
  painel.classList.remove('oculto');
  painel.innerHTML = vaga.ocupada
    ? `<div style="display: flex; flex-direction: column; gap: 4px;">
        <div><strong>Posição:</strong> ${vaga.codigo_barras}</div>
        <div><strong>Produto:</strong> ${vaga.item_codigo_barras} — ${vaga.descricao}</div>
        <div><strong>Quantidade:</strong> ${vaga.quantidade}</div>
       </div>`
    : `<strong>Posição: ${vaga.codigo_barras}</strong> — vaga livre`;
}

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
      feedback.textContent = dados.mensagem || dados.erro || 'Erro ao registrar movimentação.';
      feedback.className = 'feedback erro';
      return;
    }

    feedback.textContent = 'Movimentação registrada com sucesso.';
    feedback.className = 'feedback sucesso';
    e.target.reset();
    document.getElementById('input-quantidade').value = 1;
    inputItem.focus();
  } catch (err) {
    feedback.textContent = 'Erro ao se comunicar com o servidor. Verifique se o servidor backend está rodando com npm start.';
    feedback.className = 'feedback erro';
  }
});

// ---------- Consulta ----------
document.getElementById('form-consulta-item').addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = document.getElementById('input-consulta-item').value.trim();
  const resultado = document.getElementById('resultado-consulta-item');
  try {
    const resp = await fetch(`${API}/estoque/item/${encodeURIComponent(codigo)}`);
    const dados = await resp.json();

    resultado.innerHTML = Array.isArray(dados) && dados.length
      ? dados.map((d) => `<div class="linha-res">${d.localizacao_codigo_barras} — qtd. ${d.quantidade}</div>`).join('')
      : '<div class="linha-res">Nenhuma posição encontrada para esse produto.</div>';
  } catch (err) {
    resultado.innerHTML = '<div class="linha-res" style="color: var(--saida);">Erro ao conectar com o servidor.</div>';
  }
});

document.getElementById('form-consulta-local').addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = document.getElementById('input-consulta-local').value.trim();
  const resultado = document.getElementById('resultado-consulta-local');
  try {
    const resp = await fetch(`${API}/estoque/localizacao/${encodeURIComponent(codigo)}`);
    const dados = await resp.json();

    resultado.innerHTML = dados.ocupada
      ? `<div class="linha-res">${dados.sku} — ${dados.descricao} (qtd. ${dados.quantidade})</div>`
      : '<div class="linha-res">Vaga livre.</div>';
  } catch (err) {
    resultado.innerHTML = '<div class="linha-res" style="color: var(--saida);">Erro ao conectar com o servidor.</div>';
  }
});

// ---------- Exportação ----------
document.getElementById('btn-exportar').addEventListener('click', () => {
  window.location.href = `${API}/export/estoque.xls`;
});

// Carrega as ruas, racks e o mapa ao abrir a página (aba padrão)
carregarRuas();
