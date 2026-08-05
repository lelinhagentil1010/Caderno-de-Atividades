// ---------------------------------------------------------------
// CONFIGURAÇÃO — preencher depois de criar o projeto no Supabase
// (Project Settings → API → Project URL / anon public key)
// ---------------------------------------------------------------
const SUPABASE_CONFIG = {
  URL: '',
  ANON_KEY: ''
};

const supabaseReady = !!(SUPABASE_CONFIG.URL && SUPABASE_CONFIG.ANON_KEY);

const supabase = supabaseReady
  ? window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY)
  : null;

async function getSessionAndProfile() {
  if (!supabaseReady) return { session: null, profile: null };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, profile: null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  return { session, profile };
}

async function requireApprovedSession(redirectTo = 'index.html') {
  const { session, profile } = await getSessionAndProfile();
  if (!session || !profile || profile.status !== 'approved') {
    window.location.href = redirectTo;
    return null;
  }
  return { session, profile };
}

async function logout(redirectTo = 'index.html') {
  if (supabaseReady) await supabase.auth.signOut();
  window.location.href = redirectTo;
}
