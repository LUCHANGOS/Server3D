// Bluetooth LE Transport para Server3D (placeholder)
import { store } from '../store.js';

export class BluetoothTransport {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.connected = false;
  }

  static isSupported() {
    return 'bluetooth' in navigator;
  }

  async connect() {
    store.addConsoleMessage('Bluetooth LE no implementado completamente', 'warning');
    return false;
  }

  async disconnect() {
    store.addConsoleMessage('Bluetooth desconectado', 'info');
  }

  async sendCommand(command) {
    throw new Error('Bluetooth no conectado');
  }

  isConnected() {
    return this.connected;
  }
}

export const bluetoothTransport = new BluetoothTransport();
