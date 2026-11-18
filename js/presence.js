// Presença (Supabase Realtime Presence, canal "caderno-online").
// - Aluno: avisa o nome e o título da página em que está. Não grava nada no banco.
// - Administrador: vê uma barra no topo de qualquer página com os alunos online.
//   (No painel admin a barra já existe na própria página, então aqui não duplica.)
(async function(){
  try{
    if(typeof supabaseClient === 'undefined' || !supabaseClient) return;
    const { session, profile } = await getSessionAndProfile();
    if(!session || !profile || profile.status !== 'approved') return;

    // ---------- ADMIN: barra no topo ----------
    if(profile.role === 'admin'){
      if(document.getElementById('onlineBar')) return; // painel admin tem a sua

      const css = document.createElement('style');
      css.textContent = `
        #onlineBarGlobal{ position:fixed; top:0; left:0; right:0; z-index:9999; display:flex; align-items:center; gap:10px; padding:7px 16px; background:#142647; border-bottom:1px solid rgba(201,162,39,0.35); font-family:'Poppins',sans-serif; font-size:12.5px; color:rgba(244,239,227,0.82); overflow-x:auto; white-space:nowrap; }
        #onlineBarGlobal .dot{ width:8px; height:8px; border-radius:50%; background:#3E8E5A; box-shadow:0 0 0 3px rgba(62,142,90,0.25); flex:none; }
        #onlineBarGlobal.vazia .dot{ background:rgba(244,239,227,0.3); box-shadow:none; }
        #onlineBarGlobal strong{ color:#E7CE7C; font-weight:600; }
        #onlineBarGlobal .chip{ border:1px solid rgba(201,162,39,0.35); border-radius:999px; padding:2px 10px; color:#F4EFE3; background:rgba(201,162,39,0.08); margin-left:6px; }
        #onlineBarGlobal .chip small{ color:rgba(244,239,227,0.7); margin-left:6px; }
      `;
      document.head.appendChild(css);

      const bar = document.createElement('div');
      bar.id = 'onlineBarGlobal';
      bar.className = 'vazia';
      bar.innerHTML = '<span class="dot"></span><span class="txt">Nenhum aluno online agora</span>';
      document.body.prepend(bar);
      const txt = bar.querySelector('.txt');
      const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
      const ajustarEspaco = () => { document.body.style.paddingTop = bar.offsetHeight + 'px'; };
      ajustarEspaco();

      const canalAdmin = supabaseClient.channel('caderno-online');
      canalAdmin.on('presence', { event: 'sync' }, () => {
        const estado = canalAdmin.presenceState();
        const alunos = Object.keys(estado).map(k => estado[k][0]).filter(Boolean)
          .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
        bar.classList.toggle('vazia', alunos.length === 0);
        txt.innerHTML = alunos.length === 0
          ? 'Nenhum aluno online agora'
          : '<strong>' + alunos.length + (alunos.length === 1 ? ' aluno online' : ' alunos online') + ':</strong>' +
            alunos.map(a => '<span class="chip">' + esc(a.nome) + '<small>' + esc(a.pagina || '') + '</small></span>').join('');
        ajustarEspaco();
      }).subscribe();
      return;
    }

    // ---------- ALUNO: avisa que está online ----------
    const canal = supabaseClient.channel('caderno-online', { config: { presence: { key: session.user.id } } });
    canal.subscribe(async (estado) => {
      if(estado === 'SUBSCRIBED'){
        await canal.track({ nome: profile.nome || 'Aluno', pagina: document.title || '', desde: new Date().toISOString() });
      }
    });
    window.addEventListener('pagehide', () => { try{ canal.untrack(); }catch(e){} });
  } catch(e){ /* presença é opcional: nunca atrapalha o caderno */ }
})();
