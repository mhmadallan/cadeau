const { createHmac, timingSafeEqual, createHash } = require('node:crypto');

function equalSecret(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function createWhatsAppWebhook(db, env = process.env) {
  return {
    verify(req, res) {
      if (!env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) return res.sendStatus(503);
      if (req.query['hub.mode'] !== 'subscribe'
        || !equalSecret(req.query['hub.verify_token'], env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
        || typeof req.query['hub.challenge'] !== 'string') return res.sendStatus(403);
      return res.status(200).type('text/plain').send(req.query['hub.challenge']);
    },
    async receive(req, res) {
      if (!env.META_APP_SECRET || !env.WHATSAPP_PHONE_NUMBER_ID) return res.sendStatus(503);
      if (!Buffer.isBuffer(req.body)) return res.sendStatus(400);
      const expected = `sha256=${createHmac('sha256', env.META_APP_SECRET).update(req.body).digest('hex')}`;
      if (!equalSecret(req.get('x-hub-signature-256'), expected)) return res.sendStatus(403);
      let payload;
      try { payload = JSON.parse(req.body.toString('utf8')); }
      catch { return res.sendStatus(400); }
      if (payload?.object !== 'whatsapp_business_account') return res.sendStatus(200);
      const events = [];
      for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
        for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
          const value = change?.value;
          if (change?.field !== 'messages' || value?.metadata?.phone_number_id !== env.WHATSAPP_PHONE_NUMBER_ID) continue;
          for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
            if (!status || typeof status.id !== 'string' || status.id.length > 512
              || !['sent', 'delivered', 'read', 'failed'].includes(status.status)
              || !/^\d{1,12}$/.test(String(status.timestamp))) continue;
            const codes = (Array.isArray(status.errors) ? status.errors : [])
              .map((error) => error?.code).filter(Number.isInteger);
            // Store only delivery metadata, never customer numbers or incoming messages.
            const event = {
              message_id: status.id,
              status: status.status,
              event_timestamp: Number(status.timestamp),
              error_codes: codes,
            };
            event.event_key = createHash('sha256').update(JSON.stringify(event)).digest('hex');
            events.push(event);
          }
        }
      }
      if (!events.length) return res.sendStatus(200);
      try {
        const unique = [...new Map(events.map((event) => [event.event_key, event])).values()];
        const { error } = await db.from('whatsapp_delivery_events').upsert(unique, { onConflict: 'event_key', ignoreDuplicates: true });
        if (error) throw new Error('Persistence failed');
        for (const event of unique) console.log('WhatsApp delivery status', {
          messageId: event.message_id, status: event.status, errorCodes: event.error_codes,
        });
        return res.sendStatus(200);
      } catch {
        console.error('Could not persist WhatsApp delivery events');
        // Non-2xx lets Meta retry; do not acknowledge events that were not saved.
        return res.sendStatus(503);
      }
    },
  };
}

module.exports = { createWhatsAppWebhook };
