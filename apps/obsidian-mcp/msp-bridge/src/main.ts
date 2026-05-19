import { Plugin } from 'obsidian';
import { BridgeServer } from './server.js';
import { BridgeSync } from './sync.js';

export default class MSPBridgePlugin extends Plugin {
  private server: BridgeServer | null = null;
  private sync: BridgeSync | null = null;

  async onload() {
    console.log('loading msp-bridge plugin');

    this.server = new BridgeServer(this.app);
    this.server.start({ port: 3000 });

    this.sync = new BridgeSync(this.app);
    this.sync.initialize();

    // T3: pgvector Adapter will be initialized here
  }

  onunload() {
    console.log('unloading msp-bridge plugin');
    if (this.server) {
      this.server.stop();
    }
  }
}
