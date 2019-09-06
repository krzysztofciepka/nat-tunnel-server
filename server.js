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
      url: `http://${client.id}.${process.env.HOST}${process.env.PORT === 80 ? '' : `:${process.env.PORT}`}/`,
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
  const clientId = req.hostname.replace(`${process.env.HOST}`, '').replace(/\./g, '');
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

app.listen(process.env.PORT, () => {
  debug('NAT tunnel server started on port: ', process.env.PORT);
});
