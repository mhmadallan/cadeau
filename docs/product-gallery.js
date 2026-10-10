window.renderProductGallery = function (container, product) {
  container.replaceChildren();
  const safe = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  };
  const images = [...new Set([product.image_url, ...(product.image_urls || [])].filter(safe))];
  if (images.length) {
    const main = document.createElement('img');
    main.src = images[0];
    main.alt = product.name;
    main.className = 'w-full rounded-xl object-contain bg-white';
    main.style.maxHeight = '28rem';
    container.appendChild(main);
    if (images.length > 1) {
      const thumbnails = document.createElement('div');
      thumbnails.className = 'flex gap-2 overflow-x-auto';
      images.forEach((url, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'shrink-0 rounded-lg border border-slate-300 p-1 focus:ring-2 focus:ring-emerald-600';
        button.setAttribute('aria-label', `Show image ${index + 1} of ${product.name}`);
        button.setAttribute('aria-pressed', String(index === 0));
        const thumbnail = document.createElement('img');
        thumbnail.src = url;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        thumbnail.style.cssText = 'width:4rem;height:4rem;object-fit:cover';
        button.appendChild(thumbnail);
        button.addEventListener('click', () => {
          main.src = url;
          main.alt = `${product.name}, image ${index + 1}`;
          for (const item of thumbnails.children) item.setAttribute('aria-pressed', String(item === button));
        });
        thumbnails.appendChild(button);
      });
      container.appendChild(thumbnails);
    }
  }
  if (safe(product.video_url)) {
    const video = document.createElement('video');
    video.src = product.video_url;
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.className = 'w-full rounded-xl';
    video.setAttribute('aria-label', `${product.name} video`);
    container.appendChild(video);
  }
};
