// ---------------------------------------------------------------
// CONFIGURAÇÃO — preencher depois de criar o projeto no Supabase
// (Project Settings → API → Project URL / anon public key)
// ---------------------------------------------------------------
const SUPABASE_CONFIG = {
  URL: 'https://ntzapmachzooaekpsyia.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50emFwbWFjaHpvb2Fla3BzeWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDIxMjIsImV4cCI6MjEwMTUxODEyMn0.CC_CPCI2WeMn9W0Ra0ze6Au31GrnUH8STs6lYzz5w2Q'
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
