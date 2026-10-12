(() => {
  const form = document.getElementById('socialForm');
  const status = document.getElementById('socialStatus');
  const fields = form.querySelector('fieldset');
  async function call(options = {}) {
    const { data } = await authClient.auth.getSession();
    if (!data.session) throw new Error('Please sign in again.');
    const response = await fetch(`${apiBaseUrl}/api/admin/social-links`, {
      ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not update social links.');
    return result;
  }
  window.loadSocialSettings = async () => {
    fields.disabled = true;
    try {
      const links = await call();
      for (const name of ['instagram', 'facebook', 'tiktok']) form.elements[name].value = links[name] || '';
      fields.disabled = false;
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
  };
  document.getElementById('reloadSocial').onclick = window.loadSocialSettings;
  form.onsubmit = async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    fields.disabled = true;
    status.textContent = 'Saving...';
    try { await call({ method: 'PUT', body: JSON.stringify(body) }); status.textContent = 'Saved. The footer will use these links when visitors next load the shop.'; }
    catch (error) { status.textContent = error.message; }
    finally { fields.disabled = false; }
  };
})();
