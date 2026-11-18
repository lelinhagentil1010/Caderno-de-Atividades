// Presença: avisa ao painel da professora que o aluno está com o caderno aberto.
// Só envia o nome e o título da página; não guarda nada no banco.
(async function(){
  try{
    if(typeof supabaseClient === 'undefined' || !supabaseClient) return;
    const { session, profile } = await getSessionAndProfile();
    if(!session || !profile || profile.status !== 'approved' || profile.role === 'admin') return;
    const canal = supabaseClient.channel('caderno-online', { config: { presence: { key: session.user.id } } });
    canal.subscribe(async (estado) => {
      if(estado === 'SUBSCRIBED'){
        await canal.track({ nome: profile.nome || 'Aluno', pagina: document.title || '', desde: new Date().toISOString() });
      }
    });
    window.addEventListener('pagehide', () => { try{ canal.untrack(); }catch(e){} });
  } catch(e){ /* presença é opcional: nunca atrapalha o caderno */ }
})();
