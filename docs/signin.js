const form = document.getElementById('signinForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const googleBtn = document.getElementById('googleBtn');
const message = document.getElementById('message');

const apiBaseUrl = window.CadeauAuth.apiBaseUrl;

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
}

init().catch((error) => {
  setMessage(error.message, true);
});
