import { Agent } from 'http';
import { ConnectionError } from './Errors';

const net = require('net');
const debug = require('debug')('nat-tunnel-server:http-agent');

export class CustomHttpAgent extends Agent {
  createConnection(options, cb) {
    if (!this.socket) {
      return cb(new ConnectionError('No socket'), null);
    }
    cb(null, this.socket);
  }

  destroy() {
    super.destroy();
  }

  createServer() {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const server = new net.createServer();

      server.on('connection', (socket) => {
        debug(`Connection established on port ${socket.address().port}`);
        this.socket = socket;
        this.port = socket.address().port;

        // client reconnected - clear any pending timeout
        if (this.timeout) {
          clearTimeout(this.timeout);
        }

        socket.once('error', (err) => {
          debug(err);
          this.socket = null;
          socket.destroy();
          this.emit('error');
        });

        socket.on('close', (hasError) => {
          debug(`Connection closed on port: ${this.port} hasError: ${hasError}`);
          this.socket = null;

          // just in case there is already one
          if (this.timeout) {
            clearTimeout(this.timeout);
          }

          // release the port if client did not reconnect in 15s
          this.timeout = setTimeout(() => {
            this.emit('timeout');
            server.close();
          }, 15 * 1000);
        });
      });

      server.once('error', (err) => {
        debug(err);
        server.close();

        if (!resolved) {
          reject(new ConnectionError(err.message));
        }
      });

      server.on('close', () => {
        debug('Server closed on port: ', this.port);
      });

      server.once('listening', () => {
        debug('Server listening on port: ', server.address().port);
        resolve(server);
        resolved = true;
      });

      // force IPv4
      server.listen(0, '0.0.0.0');
    });
  }
}
