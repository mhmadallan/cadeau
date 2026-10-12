(async () => {
  try {
    const api = (window.APP_CONFIG?.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
    const response = await fetch(`${api}/api/social-links`, { cache: 'no-store' });
    if (!response.ok) return;
    const links = await response.json();
    for (const icon of document.querySelectorAll('.social-icon')) {
      const platform = icon.getAttribute('aria-label').toLowerCase();
      if (!links[platform]) continue;
      const url = new URL(links[platform]);
      if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname === platform + '.com' || url.hostname.endsWith('.' + platform + '.com'))) continue;
      const link = document.createElement('a');
      link.className = icon.className;
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', icon.getAttribute('aria-label') + ' (opens in a new tab)');
      link.append(...icon.childNodes);
      icon.replaceWith(link);
    }
  } catch { /* Unconfigured links remain non-clickable icons. */ }
})();
