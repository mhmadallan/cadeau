const form = document.getElementById('signinForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const message = document.getElementById('message');

let authClient;

function setMessage(text, isError = false) {
  message.textContent = text || '';
  message.className = `mt-3 text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`;
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

async function init() {
  if (window.CadeauAuth) {
    await window.CadeauAuth.initNavbar({
      logoutRedirect: './index.html',
      onLogoutError(error) {
        setMessage(error.message, true);
      },
      onNavbarError(error) {
        setMessage(error.message, true);
      },
    });
    authClient = await window.CadeauAuth.createAuthClient();

    const authState = await window.CadeauAuth.getAuthState(authClient);
    if (authState.isAuthenticated) {
      window.location.href = './index.html';
    }
    return;
  }

  const config = window.APP_CONFIG || {};
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Supabase client failed to load. Please disable content blockers and refresh.');
  }
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    throw new Error('Missing auth configuration.');
  }

  authClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
}

init().catch((error) => {
  setMessage(error.message, true);
});
