exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { accessToken, nome, email, senha, arquetipoHabilitado, cadernoHabilitado } = body;
  if (!accessToken || !nome || !email || !senha) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Campos obrigatórios faltando' }) };
  }
  if (senha.length < 6) {
    return { statusCode: 400, body: JSON.stringify({ error: 'A senha precisa ter pelo menos 6 caracteres' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Servidor não configurado (variáveis de ambiente ausentes)' }) };
  }

  try {
    // 1. Valida quem está chamando (precisa ser uma sessão real do Supabase)
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${accessToken}` }
    });
    if (!userRes.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Sessão inválida' }) };
    }
    const caller = await userRes.json();

    // 2. Confere se quem está chamando é admin (bypassa RLS com a service role key)
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}&select=role`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || !profiles[0] || profiles[0].role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Apenas a professora pode cadastrar alunos' }) };
    }

    // 3. Cria o aluno já aprovado (self_registered: false -> trigger define status='approved')
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome, self_registered: false }
      })
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      return {
        statusCode: createRes.status,
        body: JSON.stringify({ error: created.msg || created.error_description || 'Não foi possível criar o aluno' })
      };
    }

    // 4. Define os acessos liberados e força troca de senha no primeiro login
    // (a linha em profiles já existe nesse ponto, criada pelo trigger handle_new_user)
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${created.id}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        arquetipo_habilitado: !!arquetipoHabilitado,
        caderno_habilitado: !!cadernoHabilitado,
        deve_trocar_senha: true
      })
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, email }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro inesperado: ' + e.message }) };
  }
};
