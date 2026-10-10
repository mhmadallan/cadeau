function productMedia(body) {
  const url = value => {
    if (typeof value !== 'string' || value.length > 2048) throw new Error('Media must use HTTPS URLs, up to 2048 characters.');
    let parsed;
    try { parsed = new URL(value.trim()); } catch { throw new Error('Enter valid HTTPS media URLs.'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Media must use HTTPS URLs without embedded credentials.');
    return parsed.href;
  };
  const result = {};
  // Preserve existing galleries when an older client updates a product.
  if (body.image_url !== undefined) result.image_url = body.image_url ? url(body.image_url) : null;
  if (body.image_urls !== undefined) {
    if (!Array.isArray(body.image_urls) || body.image_urls.length > 12) throw new Error('Provide up to 12 additional image URLs.');
    result.image_urls = [...new Set(body.image_urls.map(url))];
    if (!result.image_url && result.image_urls.length) result.image_url = result.image_urls[0];
  }
  if (body.video_url !== undefined) result.video_url = body.video_url ? url(body.video_url) : null;
  return result;
}
module.exports = { productMedia };
