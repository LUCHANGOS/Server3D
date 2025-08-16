// OctoPrint Transport para Server3D (placeholder)
import { store } from '../store.js';

export class OctoPrintTransport {
  constructor() {
    this.baseUrl = null;
    this.apiKey = null;
    this.connected = false;
    this.websocket = null;
  }

  async connect(host, apiKey) {
    store.addConsoleMessage('OctoPrint no implementado completamente', 'warning');
    return false;
  }

  async disconnect() {
    store.addConsoleMessage('OctoPrint desconectado', 'info');
  }

  async sendCommand(command) {
    throw new Error('OctoPrint no conectado');
  }

  isConnected() {
    return this.connected;
  }
}

export const octoPrintTransport = new OctoPrintTransport();
