export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// Fired when the session has ended, so the app can return to the login screen.
export const SESSION_EXPIRED = 'panel:session-expired';
