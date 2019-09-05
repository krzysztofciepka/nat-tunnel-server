import { ClientExistsError, ConnectionError } from './Errors';
import { CustomHttpAgent } from './CustomHttpAgent';

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
    if (this.findClient(id)) {
      throw new ClientExistsError('Client ID already in use');
    }

    const server = await this._createServer(id);

    const client = {
      id,
      port: server.address().port,
      server,
      connected: false,
      handleRequest: (req, res) => {
        // socket not active
        if (!client.connected) {
          return res.sendStatus(503);
        }

        const options = {
          // strip client ID part
          path: `/${req.path.split('/').slice(2).join('/')}`,
          method: req.method,
          headers: req.headers,
          agent: new CustomHttpAgent(client)
        };

        const clientReq = http.request(options, (clientRes) => {
          clientRes.on('error', (err) => {
            debug(err);
          });
          res.writeHead(clientRes.statusCode, clientRes.headers);
          clientRes.pipe(res);
        });

        clientReq.on('error', (err) => {
          debug(err);
        });

        req.pipe(clientReq);
      },
    };

    this.registeredClients.push(client);
    debug('New client: ', client.id);
    return client;
  }

  _removeClient(id) {
    if (this.findClient(id)) {
      this.registeredClients.splice(
        this.registeredClients.findIndex((client) => client.id === id),
        1,
      );
      debug('Client removed');
    }
  }

  _createServer(clientId) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const server = new net.createServer();

      server.once('connection', (socket) => {
        debug('Server connected');
        const client = this.registeredClients.find((c) => c.id === clientId);
        client.connected = true;
        client.socket = socket;

        socket.once('error', (err) => {
          debug(err);

          socket.destroy();
          this._removeClient(clientId);
        });

        socket.once('close', (hasError) => {
          debug(`Socket has closed. Client: ${clientId}, hasError: ${hasError}`);
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
        debug('Server closed: ', server.address());
      });

      server.once('listening', () => {
        debug('Server listening: ', server.address());
        resolve(server);
        resolved = true;
      });

      // force IPv4
      server.listen(0, '127.0.0.1');
    });
  }
}
