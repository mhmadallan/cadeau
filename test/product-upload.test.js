const test = require('node:test');
const assert = require('node:assert/strict');
const { imageType, createProductUpload, MAX_IMAGE_BYTES } = require('../src/product-upload');
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
test('upload validates bytes and size rather than trusting file names', () => {
  assert.equal(imageType(png).mime, 'image/png');
  assert.equal(imageType(Buffer.from([255, 216, 255, 0])).mime, 'image/jpeg');
  for (const value of [Buffer.from('<svg onload="bad"/>'), Buffer.alloc(0), Buffer.alloc(MAX_IMAGE_BYTES + 1), {}]) assert.equal(imageType(value), null);
});
test('uploads unique image paths and returns public URL only after storage succeeds', async () => {
  let failed = false;
  const paths = [];
  const db = { storage: { from(bucket) {
    assert.equal(bucket, 'product-images');
    return {
      async upload(path, bytes, options) {
        paths.push(path);
        assert.equal(bytes, png);
        assert.deepEqual(options, { contentType: 'image/png', upsert: false });
        return { error: failed ? new Error('private storage details') : null };
      },
      getPublicUrl(path) { return { data: { publicUrl: `https://example.com/${path}` } }; },
    };
  } } };
  const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  for (let i = 0; i < 2; i++) {
    const res = response();
    await createProductUpload(db)({ body: png }, res);
    assert.equal(res.code, 201);
    assert.match(res.body.url, /^https:\/\/example.com\/.+\.png$/);
  }
  assert.notEqual(paths[0], paths[1]);
  failed = true;
  const res = response();
  await createProductUpload(db)({ body: png }, res);
  assert.equal(res.code, 503);
  assert.ok(!JSON.stringify(res.body).includes('private storage details'));
  const invalid = response();
  await createProductUpload(db)({ body: Buffer.from('bad') }, invalid);
  assert.equal(invalid.code, 400);
  assert.equal(paths.length, 3);
});
