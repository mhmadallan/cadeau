const form = document.getElementById('signupForm');
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
    const { error } = await authClient.auth.signUp({ email, password });
    if (error) throw error;
    setMessage('Account created. You can now sign in.');
    setTimeout(() => {
      window.location.href = './signin.html';
    }, 800);
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
