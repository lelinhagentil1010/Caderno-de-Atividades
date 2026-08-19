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

  const { accessToken, userId } = body;
  if (!accessToken || !userId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Campos obrigatórios faltando' }) };
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
      return { statusCode: 403, body: JSON.stringify({ error: 'Apenas a professora pode excluir alunos' }) };
    }

    // 3. Só deixa excluir contas de aluno (nunca admins, nem a própria conta de quem chamou)
    if (userId === caller.id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Não é possível excluir a própria conta por aqui' }) };
    }
    const targetRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    const targets = await targetRes.json();
    if (!Array.isArray(targets) || !targets[0] || targets[0].role !== 'student') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Só é possível excluir contas de aluno' }) };
    }

    // 4. Exclui o usuário (profiles/respostas/roteiros somem junto via ON DELETE CASCADE)
    const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    if (!deleteRes.ok) {
      const errBody = await deleteRes.json().catch(() => ({}));
      return {
        statusCode: deleteRes.status,
        body: JSON.stringify({ error: errBody.msg || errBody.error_description || 'Não foi possível excluir o aluno' })
      };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro inesperado: ' + e.message }) };
  }
};
