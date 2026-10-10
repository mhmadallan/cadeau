const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const element = () => ({ children: [], attrs: {}, events: {}, value: '', classList: { add() {} },
    appendChild(e) { this.children.push(e); }, append(...els) { this.children.push(...els); }, replaceChildren() { this.children = []; },
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, v) { this.events[k] = v; }, scrollTo() {}, play() { this.played = true; return Promise.resolve(); }, pause() { this.paused = true; }, focus() {},
  });
  const saved = new Map(), added = [];
  const ctx = { URL, document: { createElement: element }, localStorage: { getItem: k => saved.get(k), setItem: (k,v) => saved.set(k,v) }, window: { CadeauBag: { add: (...args) => added.push(args) } } };
  for (const file of ['product-gallery', 'collection-card']) vm.runInNewContext(fs.readFileSync(require.resolve('../docs/' + file + '.js'), 'utf8'), ctx);
  return { ctx, element, added };
}
test('collection gallery puts video last, wraps arrows and pauses hidden video', () => {
  const { ctx, element } = setup(), root = element();
  ctx.window.renderProductGallery(root, { name: 'Gift', image_url: 'https://example.com/a.jpg', image_urls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'], video_url: 'https://example.com/v.mp4' });
  const [stage] = root.children;
  const count = stage.children[4];
  assert.equal(root.children.length, 1);
  const [image, video, prev, next] = stage.children;
  next.events.click(); assert.equal(image.src, 'https://example.com/b.jpg');
  next.events.click(); assert.equal(count.textContent, '3 / 3'); assert.equal(video.hidden, false); assert.equal(image.hidden, true); assert.equal(video.muted, true); assert.equal(video.played, true);
  next.events.click(); assert.equal(video.hidden, true); assert.equal(video.paused, true); assert.equal(image.src, 'https://example.com/a.jpg');
  prev.events.click(); assert.equal(video.hidden, false);
});
test('card saves likes and requires explicit variant selection before adding one item', () => {
  const { ctx, added } = setup();
  const product = { id: 'p', name: 'Gift', stock: 2, variants: [{ id: 'v', color: 'Blue', size: 'M', stock: 2 }] };
  const card = ctx.window.createCollectionCard(product);
  const [gallery, select] = card.children;
  const actions = gallery.children[0].children.at(-1);
  const [like, add] = actions.children;
  like.events.click(); assert.equal(like.attrs['aria-pressed'], 'true');
  const other = ctx.window.createCollectionCard(product); assert.equal(other.children[0].children[0].children.at(-1).children[0].attrs['aria-pressed'], 'true');
  add.events.click(); assert.equal(select.hidden, false); assert.equal(added.length, 0);
  select.value = 'v'; add.events.click(); assert.equal(added[0][1].id, 'v'); assert.equal(added[0][2], 1);
});
