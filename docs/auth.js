const cadeauAuthConfig = window.APP_CONFIG || {};
const apiBaseUrl = (cadeauAuthConfig.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

let authClientPromise;

async function fetchAuthConfig() {
  let supabaseUrl = cadeauAuthConfig.SUPABASE_URL;
  let supabaseAnonKey = cadeauAuthConfig.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const response = await fetch(`${apiBaseUrl}/api/config`);
    const config = await response.json();

    if (!response.ok) {
      throw new Error(config.error || 'Failed to load auth config');
    }

    supabaseUrl = config.supabaseUrl;
    supabaseAnonKey = config.supabaseAnonKey;
  }

  return { supabaseUrl, supabaseAnonKey };
}

async function createAuthClient() {
  if (!authClientPromise) {
    authClientPromise = (async () => {
      const { supabaseUrl, supabaseAnonKey } = await fetchAuthConfig();
      return window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    })();
  }

  return authClientPromise;
}

async function getAuthState(clientOverride) {
  const client = clientOverride || await createAuthClient();
  const { data } = await client.auth.getSession();
  const token = (data && data.session && data.session.access_token) || '';

  if (!token) {
    return {
      client,
      token: '',
      me: null,
      isAuthenticated: false,
      isAdmin: false,
    };
  }

  let me = null;

  try {
    const response = await fetch(`${apiBaseUrl}/api/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`Failed to fetch user profile: HTTP ${response.status}`, error);
    } else {
      me = await response.json();
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    me = null;
  }

  return {
    client,
    token,
    me,
    isAuthenticated: true,
    isAdmin: !!(me && me.role === 'admin'),
  };
}

function applyNavbarState(authState) {
  const adminLink = document.getElementById('adminLink');
  const signinLink = document.getElementById('signinLink');
  const signupLink = document.getElementById('signupLink');
  const logoutBtn = document.getElementById('logoutBtn');
  const navUser = document.getElementById('navUser');

  if (signinLink) {
    signinLink.hidden = authState.isAuthenticated;
  }

  if (signupLink) {
    signupLink.hidden = authState.isAuthenticated;
  }

  if (logoutBtn) {
    logoutBtn.hidden = !authState.isAuthenticated;
  }

  if (adminLink) {
    adminLink.hidden = !authState.isAdmin;
  }

  if (navUser) {
    navUser.textContent = (authState.me && authState.me.email) || 'Guest';
  }
}

async function syncNavbar(options = {}) {
  const client = await createAuthClient();
  const authState = await getAuthState(client);
  applyNavbarState(authState);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = 'true';
    logoutBtn.addEventListener('click', async () => {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) {
        if (typeof options.onLogoutError === 'function') {
          options.onLogoutError(error);
        }
        return;
      }

      if (typeof options.afterLogout === 'function') {
        options.afterLogout();
        return;
      }

      window.location.href = options.logoutRedirect || './index.html';
    });
  }

  return authState;
}

async function initNavbar(options = {}) {
  const client = await createAuthClient();
  await syncNavbar(options);

  client.auth.onAuthStateChange(() => {
    syncNavbar(options).catch((error) => {
      if (typeof options.onNavbarError === 'function') {
        options.onNavbarError(error);
      }
    });
  });

  return { client };
}

window.CadeauAuth = {
  apiBaseUrl,
  createAuthClient,
  getAuthState,
  syncNavbar,
  initNavbar,
};
