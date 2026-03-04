const form = document.getElementById('signupForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const message = document.getElementById('message');

let authClient;

function setMessage(text, isError = false) {
  message.textContent = text || '';
  message.className = `mt-3 text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`;
}

async function createAuthClient() {
  const response = await fetch('/api/config');
  const config = await response.json();
  if (!response.ok) {
    throw new Error(config.error || 'Failed to load auth config');
  }

  authClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const { error } = await authClient.auth.signUp({ email, password });
    if (error) throw error;
    setMessage('Account created. You can now sign in.');
    setTimeout(() => {
      window.location.href = '/signin.html';
    }, 800);
  } catch (error) {
    setMessage(error.message, true);
  }
});

async function init() {
  await createAuthClient();

  const { data } = await authClient.auth.getSession();
  if (data.session) {
    window.location.href = '/';
  }
}

init().catch((error) => {
  setMessage(error.message, true);
});
