export class ClientExistsError extends Error {
  constructor(message) {
    super(message);

    this.code = 'CLIENT_EXISTS';
  }
}

export class ConnectionError extends Error {
  constructor(message) {
    super(message);

    this.code = 'CONNECTION_ERROR';
  }
}
