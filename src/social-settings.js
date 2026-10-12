const platforms = ['instagram', 'facebook', 'tiktok'];
function validateSocialLinks(body) {
  const links = {};
  for (const platform of platforms) {
    const value = body?.[platform];
    if (typeof value !== 'string' || value.length > 2048) throw new Error(`Enter a valid ${platform} URL or leave it empty.`);
    if (!value.trim()) { links[platform] = ''; continue; }
    let url;
    try { url = new URL(value.trim()); } catch { throw new Error(`Enter a full HTTPS ${platform} URL.`); }
    const domain = `${platform}.com`;
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === domain || url.hostname.endsWith('.' + domain))) throw new Error(`Use an HTTPS link on ${domain}.`);
    links[platform] = url.href;
  }
  return links;
}
function socialSettings(db) {
  return {
    async read(_req, res) {
      const { data, error } = await db.from('social_links').select('instagram,facebook,tiktok').eq('id', 1).maybeSingle();
      if (error) return res.status(503).json({ error: 'Social links are unavailable. Run the social-links database setup if needed.' });
      res.set('Cache-Control', 'no-store');
      return res.json(data || { instagram: '', facebook: '', tiktok: '' });
    },
    async save(req, res) {
      let links;
      try { links = validateSocialLinks(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
      const { error } = await db.from('social_links').upsert({ id: 1, ...links });
      if (error) return res.status(503).json({ error: 'Could not save social links. Check the social-links database setup and retry.' });
      return res.json(links);
    },
  };
}
module.exports = { validateSocialLinks, socialSettings };
