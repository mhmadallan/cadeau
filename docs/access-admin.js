(() => {
  let page = 0;
  const root = document.getElementById('accessRequests');
  const status = document.getElementById('accessRequestStatus');
  async function call(path, options = {}) {
    const { data } = await authClient.auth.getSession();
    const response = await fetch(`${apiBaseUrl}/api/admin/access${path}`, {
      ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed');
    return result;
  }
  async function load() {
    try {
      const rows = await call(`?page=${page}`);
      root.replaceChildren();
      document.getElementById('accessPrevious').disabled = page === 0;
      document.getElementById('accessNext').disabled = rows.length < 50;
      for (const row of rows) {
        const card = document.createElement('article');
        card.className = 'my-3 rounded-lg border border-slate-200 p-3';
        const text = document.createElement('p');
        text.textContent = `${row.name} | ${row.phone} | ${row.status} | Admin notification: ${row.request_notification || 'pending'} | Approval notification: ${row.approval_notification || 'not sent'}`;
        card.appendChild(text);
        for (const [label, decision] of [['Approve', 'approved'], ['Reject / revoke', 'rejected']]) {
          const button = document.createElement('button');
          button.textContent = label;
          button.className = 'mr-3 mt-2 rounded-lg bg-slate-900 px-3 py-2 text-white';
          button.disabled = row.status === decision;
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              const result = await call(`/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: decision }) });
              status.textContent = `Decision saved.${result.notification ? ` WhatsApp notification: ${result.notification}.` : ''}`;
              await load();
            } catch (error) { status.textContent = error.message; button.disabled = false; }
          });
          card.appendChild(button);
        }
        root.appendChild(card);
      }
      if (!rows.length) root.textContent = 'No access requests on this page.';
    } catch (error) { status.textContent = error.message; }
  }
  document.getElementById('refreshAccess').addEventListener('click', load);
  document.getElementById('accessPrevious').addEventListener('click', () => { page = Math.max(0, page - 1); load(); });
  document.getElementById('accessNext').addEventListener('click', () => { page++; load(); });
  window.loadAccessRequests = load;
})();
