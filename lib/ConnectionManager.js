import { ClientExistsError, ConnectionError } from './Errors';

const http = require('http');
const net = require('net');
const debug = require('debug')('nat-tunnel-server:conn-mgr');

export class ConnectionManager {
  constructor() {
    this.registeredClients = [];
  }

  findClient(id) {
    return this.registeredClients.find((client) => client.id === id);
  }

  async registerClient(id) {
    if (this.registeredClients.some((client) => client.id === id)) {
      throw new ClientExistsError('Client ID already in use');
    }

    const server = await this._createServer(id);

    const client = {
      id,
      server,
      connected: false,
      handleRequest: (req, res) => {
        // socket not active
        if (!client.connected) {
          return res.sendStatus(503);
        }

        const opt = {
          // strip client ID part
          path: req.url.split('/').slice(2).join('/'),
          method: req.method,
          headers: req.headers,
        };

        const clientReq = http.request(opt, (clientRes) => {
          res.writeHead(clientRes.statusCode, clientRes.headers);
          clientRes.pipe(res);
        });

        req.pipe(clientReq);
      },
    };

    this.registeredClients.push(client);
    debug('New client: ', client.id);
    return client;
  }

  _removeClient(id) {
    if (this.registeredClients.some((client) => client.id === id)) {
      this.registeredClients.splice(
        this.registeredClients.findIndex((client) => client.id === id),
        1,
      );
    }
  }

  _createServer(clientId) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const server = new net.createServer((socket) => {
        socket.once('error', (err) => {
          debug(err);

          socket.destroy();
          this._removeClient(clientId);
        });

        socket.once('end', () => {
          debug('Client disconnected: ', clientId);
          this._removeClient(clientId);
        });

        socket.once('close', (hasError) => {
          debug(`Socket has closed. Client: ${clientId}, hasError: ${hasError}`);
          this._removeClient(clientId);
        });

        socket.connect(() => {
          debug('Client connected: ', clientId);
          const client = this.registeredClients.find((c) => c.id === clientId);
          client.socket = socket;
          client.connected = true;
        });
      });

      server.once('error', (err) => {
        debug(err);

        server.close();
        this._removeClient(clientId);

        if (!resolved) {
          reject(new ConnectionError(err.message));
        }
      });

      server.once('close', () => {
        debug('server closed: ', server.address());
      });

      server.once('listening', () => {
        debug('server listening: ', server.address());
        resolve(server);
        resolved = true;
      });

      server.listen(0, '127.0.0.1');
    });
  }
}
