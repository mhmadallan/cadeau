// Device uploads fill the same URL fields used when saving a product.
// Keep completed URLs after partial failures so retrying does not lose them.
for (const kind of ['cover', 'gallery']) {
  const input = document.getElementById(`${kind}Files`);
  input.addEventListener('change', async () => {
    const files = Array.from(input.files);
    if (!files.length) return;
    const status = document.getElementById('uploadStatus');
    const cover = document.getElementById('image_url');
    const gallery = document.getElementById('image_urls');
    const currentGallery = () => gallery.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (kind === 'gallery' && currentGallery().length + files.length > 12) {
      status.textContent = 'Use up to 12 additional images in total, including URLs.';
      input.value = '';
      return;
    }
    if (files.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024)) {
      status.textContent = 'Choose JPEG or PNG images, each no larger than 5 MB.';
      input.value = '';
      return;
    }
    const controls = Array.from(document.querySelectorAll('#productForm input, #productForm textarea, #productForm button'));
    const disabled = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    try {
      const { data } = await authClient.auth.getSession();
      if (!data.session) throw new Error('Sign in again before uploading images.');
      for (let i = 0; i < files.length; i++) {
        status.textContent = `Uploading image ${i + 1} of ${files.length}…`;
        const response = await fetch(`${apiBaseUrl}/api/admin/product-images`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': files[i].type },
          body: files[i],
          signal: AbortSignal.timeout(60000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Image upload failed. Please retry.');
        if (kind === 'cover') cover.value = result.url;
        else gallery.value = [...currentGallery(), result.url].join('\n');
      }
      status.textContent = 'Images uploaded. Save the product to apply them.';
    } catch (error) {
      status.textContent = `${error.message} Any completed uploads remain in the URL fields.`;
    } finally {
      controls.forEach((control, index) => { control.disabled = disabled[index]; });
      input.value = '';
    }
  });
}
