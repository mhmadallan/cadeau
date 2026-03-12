const form = document.getElementById('signinForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const googleBtn = document.getElementById('googleBtn');
const message = document.getElementById('message');

const appConfig = window.APP_CONFIG || {};
const apiBaseUrl = (appConfig.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

let authClient;

function setMessage(text, isError = false) {
  message.textContent = text || '';
  message.className = `mt-3 text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`;
}

async function createAuthClient() {
  let supabaseClientUrl = appConfig.SUPABASE_URL;
  let supabaseClientAnonKey = appConfig.SUPABASE_ANON_KEY;

  if (!supabaseClientUrl || !supabaseClientAnonKey) {
    const response = await fetch(`${apiBaseUrl}/api/config`);
    const config = await response.json();
    if (!response.ok) {
      throw new Error(config.error || 'Failed to load auth config');
    }
    supabaseClientUrl = config.supabaseUrl;
    supabaseClientAnonKey = config.supabaseAnonKey;
  }

  authClient = window.supabase.createClient(supabaseClientUrl, supabaseClientAnonKey);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const { error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    window.location.href = './index.html';
  } catch (error) {
    setMessage(error.message, true);
  }
});

googleBtn.addEventListener('click', async () => {
  try {
    const redirectTo = new URL('./index.html', window.location.href).toString();
    const { error } = await authClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    if (error) throw error;
  } catch (error) {
    setMessage(error.message, true);
  }
});

async function init() {
  await createAuthClient();

  const { data } = await authClient.auth.getSession();
  if (data.session) {
    window.location.href = './index.html';
  }
}

init().catch((error) => {
  setMessage(error.message, true);
});
