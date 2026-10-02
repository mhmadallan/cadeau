class NotificationConfigError extends Error {
  constructor(fields) {
    super(`Missing or invalid notification settings: ${fields.join(', ')}`);
    this.name = 'NotificationConfigError';
  }
}

module.exports = { NotificationConfigError };
