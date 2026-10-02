// Phone sessions grant shop access only. Email-based admin auth remains separate.
window.ShopSession = {
  key: 'cadeau-phone-session',
  read() {
    try {
      const session = JSON.parse(localStorage.getItem(this.key) || 'null');
      if (session && Date.parse(session.expires_at) > Date.now()) return session;
    } catch { /* Treat malformed browser storage as logged out. */ }
    return null;
  },
  wrap(client, api) {
    const store = this;
    if (!store.read()) return client;
    return { auth: {
      async getSession() { return { data: { session: store.read() } }; },
      onAuthStateChange(callback) {
        window.addEventListener('storage', (event) => {
          if (event.key === store.key) callback('SESSION_CHANGED', store.read());
        });
      },
      async signOut() {
        const session = store.read();
        try {
          const response = await fetch(`${api}/api/access/logout`, { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
          if (!response.ok) return { error: new Error('Could not sign out. Please retry.') };
          localStorage.removeItem(store.key);
          return { error: null };
        } catch { return { error: new Error('Could not sign out. Please retry.') }; }
      },
    } };
  },
};
