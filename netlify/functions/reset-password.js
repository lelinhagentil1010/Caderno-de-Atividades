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

  const { accessToken, userId, novaSenha } = body;
  if (!accessToken || !userId || !novaSenha) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Campos obrigatórios faltando' }) };
  }
  if (novaSenha.length < 6) {
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
      return { statusCode: 403, body: JSON.stringify({ error: 'Apenas a professora pode redefinir senhas' }) };
    }

    // 3. Redefine a senha do aluno
    const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: novaSenha })
    });
    if (!updateRes.ok) {
      const errBody = await updateRes.json().catch(() => ({}));
      return {
        statusCode: updateRes.status,
        body: JSON.stringify({ error: errBody.msg || errBody.error_description || 'Não foi possível redefinir a senha' })
      };
    }

    // 4. Marca a senha como provisória: o aluno precisa trocar por uma própria no próximo login
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ deve_trocar_senha: true })
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro inesperado: ' + e.message }) };
  }
};
