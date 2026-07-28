const API = '';

// ---------- Navegação entre abas ----------
document.querySelectorAll('.aba').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.aba').forEach((b) => b.classList.remove('ativa'));
    document.querySelectorAll('.painel').forEach((p) => p.classList.remove('painel-ativo'));
    btn.classList.add('ativa');
    document.getElementById('painel-' + btn.dataset.aba).classList.add('painel-ativo');
    if (btn.dataset.aba === 'mapa') carregarMapa();
  });
});

// ---------- Mapa do rack (grade visual) ----------
async function carregarMapa() {
  const grade = document.getElementById('grade-rack');
  try {
    const resp = await fetch(`${API}/estoque/mapa/1`);
    const vagas = await resp.json();

    if (!resp.ok || !Array.isArray(vagas)) {
      grade.innerHTML = `<div style="grid-column: 1 / -1; padding: 16px; color: var(--saida); background: #fdf2f2; border: 1px solid var(--saida); border-radius: 4px;">
        Erro ao carregar o estoque: ${vagas.detalhe || vagas.erro || 'Não foi possível conectar ao banco de dados.'}
      </div>`;
      return;
    }

    grade.innerHTML = '';
    grade.appendChild(document.createElement('div')); // canto vazio

    for (let c = 1; c <= 7; c++) {
      const rot = document.createElement('div');
      rot.className = 'rotulo-coluna';
      rot.textContent = 'C' + c;
      grade.appendChild(rot);
    }

    ['A', 'B', 'C', 'D', 'E'].forEach((prateleira) => {
      const rot = document.createElement('div');
      rot.className = 'rotulo-prateleira';
      rot.textContent = prateleira;
      grade.appendChild(rot);

      for (let c = 1; c <= 7; c++) {
        const vaga = vagas.find((v) => v.coluna === c && v.prateleira === prateleira);
        const el = document.createElement('div');
        el.className = 'vaga' + (vaga && vaga.ocupada ? ' ocupada' : '');
        if (vaga && vaga.ocupada) {
          el.title = `${vaga.item_codigo_barras || ''} — ${vaga.descricao || ''}`;
          el.innerHTML = `<span class="vaga-desc">${vaga.item_codigo_barras || ''} — ${vaga.descricao || ''}</span>`;
        } else {
          el.title = 'Vaga livre';
          el.textContent = '';
        }
        el.addEventListener('click', () => mostrarDetalheVaga(vaga));
        grade.appendChild(el);
      }
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
    quantidade: 1,
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

// Carrega o mapa ao abrir a página (aba padrão)
carregarMapa();
