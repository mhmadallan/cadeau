window.renderProductGallery = function (container, product) {
  container.replaceChildren();
  container.classList.add('product-gallery');
  const safe = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  };
  const images = [...new Set([product.image_url, ...(product.image_urls || [])].filter(safe))];
  const slides = images.map(src => ({ src, video: false }));
  if (safe(product.video_url)) slides.push({ src: product.video_url, video: true });
  if (!slides.length) slides.push({ src: './product-placeholder.svg', video: false });
  if (slides.length) {
    let current = 0;
    const stage = document.createElement('div');
    stage.className = 'gallery-stage';
    stage.setAttribute('role', 'region');
    stage.setAttribute('aria-label', product.name + ' images');
    const main = document.createElement('img');
    main.className = 'gallery-main';
    const video = document.createElement('video');
    video.className = 'gallery-main';
    video.controls = true;
    video.playsInline = true;
    video.muted = true;
    video.loop = true;
    video.preload = 'none';
    video.hidden = true;
    if (safe(product.video_url)) video.src = product.video_url;
    video.setAttribute('aria-label', product.name + ' video');
    stage.appendChild(main);
    stage.appendChild(video);
    container.appendChild(stage);
    const counter = document.createElement('p');
    counter.className = 'gallery-counter';
    counter.setAttribute('aria-live', 'polite');

    const show = index => {
      current = (index + slides.length) % slides.length;
      video.pause();
      main.hidden = slides[current].video;
      video.hidden = !slides[current].video;
      if (!slides[current].video) main.src = slides[current].src;
      main.alt = product.name + ', image ' + (current + 1);
      counter.textContent = (current + 1) + ' / ' + slides.length;
      if (slides[current].video) {
        const playback = video.play();
        if (playback) playback.catch(() => {});
      }
    };
    if (slides.length > 1) {
      for (const [label, symbol, step] of [['Previous slide', '\u2039', -1], ['Next slide', '\u203a', 1]]) {
        const arrow = document.createElement('button');
        arrow.type = 'button';
        arrow.className = 'gallery-arrow ' + (step < 0 ? 'gallery-prev' : 'gallery-next');
        arrow.setAttribute('aria-label', label);
        arrow.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (step < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '"/></svg>';
        arrow.addEventListener('click', () => show(current + step));
        stage.appendChild(arrow);
      }
      stage.addEventListener('keydown', event => {
        if (event.target === video) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          show(current + (event.key === 'ArrowLeft' ? -1 : 1));
        }
      });
      stage.appendChild(counter);
    }
    show(0);
  }
};
