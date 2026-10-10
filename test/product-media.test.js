const test = require('node:test');
const assert = require('node:assert/strict');
const { productMedia } = require('../src/product-media');

test('stores gallery and video while preserving cover used by notifications', () => {
  const result = productMedia({ image_url: 'https://example.com/cover.jpg', image_urls: ['https://example.com/other.jpg'], video_url: 'https://example.com/demo.mp4' });
  assert.equal(result.image_url, 'https://example.com/cover.jpg');
  assert.deepEqual(result.image_urls, ['https://example.com/other.jpg']);
  assert.equal(result.video_url, 'https://example.com/demo.mp4');
  assert.deepEqual(productMedia({}), {});
  assert.equal(productMedia({ image_url: '', image_urls: ['https://example.com/first.jpg'] }).image_url, 'https://example.com/first.jpg');
  assert.deepEqual(productMedia({ image_url: '', image_urls: [], video_url: '' }), { image_url: null, image_urls: [], video_url: null });
});

test('rejects unsafe media URLs and oversized galleries', () => {
  for (const value of ['javascript:alert(1)', 'http://example.com/a.jpg', 'https://user:secret@example.com/a.jpg', 42]) {
    assert.throws(() => productMedia({ image_url: value }));
    assert.throws(() => productMedia({ video_url: value }));
    assert.throws(() => productMedia({ image_urls: [value] }));
  }
  assert.throws(() => productMedia({ image_urls: 'bad' }));
  assert.throws(() => productMedia({ image_urls: Array(13).fill('https://example.com/a.jpg') }));
});
