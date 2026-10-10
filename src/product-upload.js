const { randomUUID } = require('node:crypto');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function imageType(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: 'png', mime: 'image/png' };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: 'jpg', mime: 'image/jpeg' };
  return null;
}

function createProductUpload(db) {
  return async (req, res) => {
    const type = imageType(req.body);
    if (!type) return res.status(400).json({ error: 'Choose a JPEG or PNG image no larger than 5 MB.' });
    const bucket = db.storage.from('product-images');
    const path = `${randomUUID()}.${type.extension}`;
    const { error } = await bucket.upload(path, req.body, { contentType: type.mime, upsert: false });
    if (error) return res.status(503).json({ error: 'Image upload failed. Check that the product-images storage bucket is configured, then retry.' });
    const { data } = bucket.getPublicUrl(path);
    return res.status(201).json({ url: data.publicUrl });
  };
}

module.exports = { createProductUpload, imageType, MAX_IMAGE_BYTES };
