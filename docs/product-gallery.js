window.renderProductGallery = function (container, product) {
  container.replaceChildren();
  container.classList.add('product-gallery');
  const safe = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  };
  const images = [...new Set([product.image_url, ...(product.image_urls || [])].filter(safe))];
  if (images.length) {
    let current = 0;
    const stage = document.createElement('div');
    stage.className = 'gallery-stage';
    stage.setAttribute('role', 'region');
    stage.setAttribute('aria-label', product.name + ' images');
    const main = document.createElement('img');
    main.className = 'gallery-main';
    stage.appendChild(main);
    container.appendChild(stage);
    const thumbs = document.createElement('div');
    thumbs.className = 'gallery-thumbnails';
    const counter = document.createElement('p');
    counter.className = 'gallery-counter';
    counter.setAttribute('aria-live', 'polite');
    const buttons = [];
    const show = index => {
      current = (index + images.length) % images.length;
      main.src = images[current];
      main.alt = product.name + ', image ' + (current + 1);
      counter.textContent = (current + 1) + ' / ' + images.length;
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
      const active = buttons[current];
      if (active) thumbs.scrollTo({ left: active.offsetLeft - thumbs.offsetLeft - (thumbs.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
    };
    if (images.length > 1) {
      for (const [label, symbol, step] of [['Previous image', '?', -1], ['Next image', '?', 1]]) {
        const arrow = document.createElement('button');
        arrow.type = 'button';
        arrow.className = 'gallery-arrow ' + (step < 0 ? 'gallery-prev' : 'gallery-next');
        arrow.setAttribute('aria-label', label);
        arrow.textContent = symbol;
        arrow.addEventListener('click', () => show(current + step));
        stage.appendChild(arrow);
      }
      stage.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          show(current + (event.key === 'ArrowLeft' ? -1 : 1));
        }
      });
      images.forEach((url, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gallery-thumbnail';
        button.setAttribute('aria-label', 'Show image ' + (index + 1) + ' of ' + product.name);
        const thumbnail = document.createElement('img');
        thumbnail.src = url;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        button.appendChild(thumbnail);
        button.addEventListener('click', () => show(index));
        buttons.push(button);
        thumbs.appendChild(button);
      });
      container.appendChild(counter);
      container.appendChild(thumbs);
    }
    show(0);
  }
  if (safe(product.video_url)) {
    const video = document.createElement('video');
    video.src = product.video_url;
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.className = 'gallery-video';
    video.setAttribute('aria-label', product.name + ' video');
    container.appendChild(video);
  }
};
