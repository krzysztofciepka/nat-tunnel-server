import { ConnectionManager } from './lib/ConnectionManager';
import { ClientExistsError } from './lib/Errors';

const express = require('express');
const debug = require('debug')('nat-tunnel-server:server');

const app = express();

const connManager = new ConnectionManager();

app.get('/api/register/:id', async (req, res) => {
  try {
    const client = await connManager.registerClient(req.params.id);

    return res.send({
      url: `http://localhost:3000/${client.id}`,
    });
  } catch (err) {
    debug(err);
    if (err instanceof ClientExistsError) {
      return res.sendStatus(400);
    }
    return res.sendStatus(500);
  }
});

app.use((req, res) => {
  const path = req.path.split('/');

  // missing client ID
  if (path.length < 2) {
    return res.sendStatus(400);
  }

  const client = connManager.findClient(path[1]);

  if (!client) {
    return res.sendStatus(404);
  }

  client.handleRequest(req, res);
});

app.listen(3000, () => {
  debug('Server started');
});
