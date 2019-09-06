import { ConnectionManager } from './lib/ConnectionManager';
import { ClientExistsError } from './lib/Errors';

const express = require('express');
const debug = require('debug')('nat-tunnel-server:server');

const app = express();

if (process.env.NODE_ENV === 'development') {
  app.set('subdomain offset', 1);
}

const connManager = new ConnectionManager();

app.get('/api/register/:id', async (req, res) => {
  try {
    const client = await connManager.registerClient(req.params.id);

    return res.send({
      url: `http://${client.id}.${process.env.HOSTNAME}/`,
      port: client.port,
    });
  } catch (err) {
    debug(err);
    if (err instanceof ClientExistsError) {
      return res.status(400).send({
        error: err.message,
      });
    }
    return res.sendStatus(500);
  }
});

app.use((req, res) => {
  const { subdomains } = req;
  // missing client ID
  if (!subdomains.length) {
    return res.sendStatus(400);
  }

  const client = connManager.findClient(subdomains[0]);

  if (!client) {
    return res.sendStatus(404);
  }

  debug('Received valid request for client: ', client.id);
  client.handleRequest(req, res);
});

app.listen(process.env.PORT, () => {
  debug('NAT tunnel server started on port: ', process.env.PORT);
});
