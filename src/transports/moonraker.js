// Moonraker Transport para Server3D (placeholder)
import { store } from '../store.js';

export class MoonrakerTransport {
  constructor() {
    this.baseUrl = null;
    this.websocket = null;
    this.connected = false;
  }

  async connect(host) {
    store.addConsoleMessage('Moonraker no implementado completamente', 'warning');
    return false;
  }

  async disconnect() {
    store.addConsoleMessage('Moonraker desconectado', 'info');
  }

  async sendCommand(command) {
    throw new Error('Moonraker no conectado');
  }

  isConnected() {
    return this.connected;
  }
}

export const moonrakerTransport = new MoonrakerTransport();
