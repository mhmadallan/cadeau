const cadeauAuthConfig = window.APP_CONFIG || {};
const apiBaseUrl = (cadeauAuthConfig.API_BASE_URL || '').replace(/\/+$/, '');

if (!apiBaseUrl) {
  throw new Error('Missing API_BASE_URL in config.js');
}

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

async function getSessionOnlyState(clientOverride) {
  const client = clientOverride || await createAuthClient();
  const { data } = await client.auth.getSession();
  const token = (data && data.session && data.session.access_token) || '';
  const sessionUser = (data && data.session && data.session.user) || null;

  return {
    client,
    token,
    me: null,
    sessionUser,
    isAuthenticated: !!token,
    isAdmin: false,
  };
}

async function getAuthState(clientOverride) {
  const sessionState = await getSessionOnlyState(clientOverride);

  if (!sessionState.token) {
    return sessionState;
  }

  let me = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${apiBaseUrl}/api/me`, {
      headers: {
        Authorization: `Bearer ${sessionState.token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      me = await response.json();
    }
  } catch (_error) {
    // timed out or failed — session email fallback applies
  }

  return {
    ...sessionState,
    me,
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
    navUser.textContent = (authState.me && authState.me.email)
      || (authState.sessionUser && authState.sessionUser.email)
      || 'Guest';
  }
}

async function syncNavbar(options = {}) {
  const client = await createAuthClient();

  // Phase 1: apply session state immediately so email shows without waiting for /api/me
  const sessionState = await getSessionOnlyState(client);
  applyNavbarState(sessionState);

  // Bind logout button immediately so it works during profile fetch
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

  // Phase 2: fetch /api/me (may be slow on Render cold start, has 8s timeout)
  // Update navbar again once profile resolves to add admin link and role info
  const authState = await getAuthState(client);
  applyNavbarState(authState);

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
