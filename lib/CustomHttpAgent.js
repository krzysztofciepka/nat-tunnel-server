import { Agent } from "http";

export class CustomHttpAgent extends Agent {
    constructor(client) {
        super();
        this.client = client;
    }

    createConnection(options, cb) {
        cb(null, this.client.socket)
    }

    destroy() {
        this.client.server.close();
        super.destroy();
    }
}

