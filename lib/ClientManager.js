import { ClientExistsError } from './Errors';
import { CustomHttpAgent } from './CustomHttpAgent';

const http = require('http');
const debug = require('debug')('nat-tunnel-server:client-manager');

export class ClientManager {
  constructor() {
    this.registeredClients = [];
  }

  findClient(id) {
    return this.registeredClients.find((client) => client.id === id);
  }

  async registerClient(id) {
    if (this.findClient(id)) {
      throw new ClientExistsError(`Client ID ${id} already in use`);
    }

    const agent = new CustomHttpAgent();
    const server = await agent.createServer();

    const client = {
      id,
      port: server.address().port,
      handleRequest: (req, res) => {
        const options = {
          // strip client ID part
          path: process.env.URL_SCHEME === 'subdomain' ? req.url : `/${req.path.split('/').slice(2).join('/')}`,
          method: req.method,
          headers: req.headers,
          agent,
        };

        const clientReq = http.request(options, (clientRes) => {
          clientRes.once('error', (err) => {
            debug(err);
          });
          res.writeHead(clientRes.statusCode, clientRes.headers);
          clientRes.pipe(res);
        });

        clientReq.once('error', (err) => {
          debug(err);
          res.write(Buffer.from(JSON.stringify({ error: err.message })));
          res.end();
        });

        req.pipe(clientReq);
      },
    };

    agent.once('timeout', () => {
      // release client ID on socket timeout
      debug(`Release timeout for client ${client.id}`);
      this._removeClient(client.id);
    });


    this.registeredClients.push(client);
    debug(`New client: ${client.id}`);
    return client;
  }

  _removeClient(id) {
    if (this.findClient(id)) {
      this.registeredClients.splice(
        this.registeredClients.findIndex((client) => client.id === id),
        1,
      );
      debug(`Client ${id} removed`);
    }
  }
}
