import { ClientManager } from './lib/ClientManager';
import { ClientExistsError } from './lib/Errors';
import { Utils } from './lib/Utils';

const express = require('express');
const debug = require('debug')('nat-tunnel-server:server');

const app = express();

if (process.env.NODE_ENV === 'development') {
  app.set('subdomain offset', 1);
}

const clientManager = new ClientManager();

app.get('/api/register/:id', async (req, res) => {
  try {
    if (!Utils.validateId(req.params.id)) {
      return res.status(400).send({
        error: 'Client ID must be between 5 and 64 alphanumeric characters',
      });
    }

    const client = await clientManager.registerClient(req.params.id);

    return res.send({
      url: process.env.URL_SCHEME === 'subdomain'
        ? `http://${client.id}.${process.env.HOST}${process.env.PORT === 80 ? '' : `:${process.env.PORT}`}/`
        : `http://${process.env.HOST}${process.env.PORT === 80 ? '' : `:${process.env.PORT}`}/${client.id}/`,
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

// all other requests should be forwarded
app.use((req, res) => {
  const clientId = Utils.resolveId(req);
  if (!clientId) {
    return res.status(400).send({
      error: 'Missing client ID',
    });
  }

  const client = clientManager.findClient(clientId);

  if (!client) {
    return res.status(404).send({
      error: 'Client does not exist',
    });
  }

  debug('Received request for: ', client.id);
  client.handleRequest(req, res);
});

const server = app.listen(process.env.PORT, () => {
  debug('NAT tunnel server started on port: ', process.env.PORT);
});

server.timeout = 900000; // 15 minutes
