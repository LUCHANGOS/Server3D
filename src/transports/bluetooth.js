// Bluetooth LE Transport para Server3D - UART/NUS Service
import { store } from '../store.js';

export class BluetoothTransport {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.rxCharacteristic = null; // Para recibir datos
    this.txCharacteristic = null; // Para enviar datos
    this.connected = false;
    this.receiveBuffer = '';
    
    // Nordic UART Service (NUS) UUIDs
    this.SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
    this.RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write
    this.TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Notify
  }

  static isSupported() {
    return 'bluetooth' in navigator && navigator.bluetooth;
  }

  async connect() {
    try {
      if (!BluetoothTransport.isSupported()) {
        throw new Error('Web Bluetooth API no soportada en este navegador');
      }

      store.setConnection('bluetooth', 'connecting');
      store.addConsoleMessage('Solicitando dispositivo Bluetooth LE...', 'info');

      // Solicitar dispositivo con filtros para UART
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [this.SERVICE_UUID] },
          { namePrefix: 'ESP32' },
          { namePrefix: 'Arduino' },
          { namePrefix: 'Printer' }
        ],
        optionalServices: [this.SERVICE_UUID]
      });

      store.addConsoleMessage(`Conectando a: ${this.device.name}`, 'info');

      // Conectar al servidor GATT
      this.server = await this.device.gatt.connect();
      
      // Obtener servicio UART
      this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
      
      // Obtener características RX y TX
      this.rxCharacteristic = await this.service.getCharacteristic(this.RX_CHARACTERISTIC_UUID);
      this.txCharacteristic = await this.service.getCharacteristic(this.TX_CHARACTERISTIC_UUID);
      
      // Configurar notificaciones para recibir datos
      await this.txCharacteristic.startNotifications();
      this.txCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotification.bind(this));
      
      // Manejar desconexión
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));
      
      this.connected = true;
      store.setConnection('bluetooth', 'connected', { name: this.device.name });
      store.addConsoleMessage(`Conectado a ${this.device.name} via Bluetooth LE`, 'info');
      
      // Handshake inicial
      await this.sendCommand('M115');
      
      // Iniciar polling de temperatura
      this.startTemperaturePolling();
      
      return true;
      
    } catch (error) {
      store.addConsoleMessage(`Error conectando Bluetooth: ${error.message}`, 'error');
      store.setConnection('bluetooth', 'disconnected');
      await this.disconnect();
      return false;
    }
  }

  // Manejar notificaciones (datos recibidos)
  handleNotification(event) {
    const value = event.target.value;
    const text = new TextDecoder().decode(value);
    
    // Acumular en buffer hasta recibir línea completa
    this.receiveBuffer += text;
    
    const lines = this.receiveBuffer.split('\n');
    this.receiveBuffer = lines.pop() || ''; // Mantener línea incompleta
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine) {
        this.handleResponse(cleanLine);
      }
    }
  }

  // Manejar respuestas
  handleResponse(response) {
    store.addConsoleMessage(`< ${response}`, 'info');
    
    // Parsear temperaturas
    this.parseTemperatureResponse(response);
    
    // Parsear posición
    this.parsePositionResponse(response);
    
    // Notificar al streamer
    if (window.gcodeStreamer) {
      window.gcodeStreamer.handleResponse(response);
    }
  }

  // Parsear temperaturas (similar a Serial)
  parseTemperatureResponse(response) {
    if (response.startsWith('T:') || response.includes('T:')) {
      const hotendMatch = response.match(/T:(\d+\.?\d*)\s*\/(\d+\.?\d*)/);
      const bedMatch = response.match(/B:(\d+\.?\d*)\s*\/(\d+\.?\d*)/);
      
      if (hotendMatch) {
        store.setTemperatures({
          hotend: {
            current: parseFloat(hotendMatch[1]),
            target: parseFloat(hotendMatch[2])
          }
        });
      }
      
      if (bedMatch) {
        store.setTemperatures({
          bed: {
            current: parseFloat(bedMatch[1]),
            target: parseFloat(bedMatch[2])
          }
        });
      }
    }
  }

  // Parsear posición
  parsePositionResponse(response) {
    if (response.startsWith('X:') || response.includes('X:')) {
      const xMatch = response.match(/X:([+-]?\d+\.?\d*)/);
      const yMatch = response.match(/Y:([+-]?\d+\.?\d*)/);
      const zMatch = response.match(/Z:([+-]?\d+\.?\d*)/);
      
      if (xMatch || yMatch || zMatch) {
        const position = {};
        if (xMatch) position.x = parseFloat(xMatch[1]);
        if (yMatch) position.y = parseFloat(yMatch[1]);
        if (zMatch) position.z = parseFloat(zMatch[1]);
        
        store.setPosition(position);
      }
    }
  }

  // Enviar comando
  async sendCommand(command) {
    if (!this.connected || !this.rxCharacteristic) {
      throw new Error('Bluetooth no conectado');
    }

    try {
      const commandWithNewline = command.trim() + '\n';
      const data = new TextEncoder().encode(commandWithNewline);
      
      // Fragmentar si es necesario (BLE tiene límite ~20 bytes por packet)
      const chunkSize = 20;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await this.rxCharacteristic.writeValue(chunk);
        
        // Pequeña pausa entre chunks
        if (i + chunkSize < data.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      store.addConsoleMessage(`> ${command}`, 'info');
      
    } catch (error) {
      throw new Error(`Error enviando comando BLE: ${error.message}`);
    }
  }

  // Polling de temperatura
  startTemperaturePolling() {
    if (this.tempInterval) {
      clearInterval(this.tempInterval);
    }
    
    this.tempInterval = setInterval(async () => {
      if (this.connected) {
        try {
          await this.sendCommand('M105');
        } catch (error) {
          console.error('Error en temperature polling BLE:', error);
        }
      }
    }, window.appConfig?.tempQueryInterval || 3000);
  }

  // Manejar desconexión
  handleDisconnection() {
    store.addConsoleMessage('Bluetooth desconectado inesperadamente', 'warning');
    this.disconnect();
  }

  async disconnect() {
    try {
      this.connected = false;
      
      if (this.tempInterval) {
        clearInterval(this.tempInterval);
        this.tempInterval = null;
      }
      
      if (this.txCharacteristic) {
        await this.txCharacteristic.stopNotifications();
        this.txCharacteristic.removeEventListener('characteristicvaluechanged', this.handleNotification);
      }
      
      if (this.device && this.device.gatt.connected) {
        await this.device.gatt.disconnect();
      }
      
      this.device = null;
      this.server = null;
      this.service = null;
      this.rxCharacteristic = null;
      this.txCharacteristic = null;
      this.receiveBuffer = '';
      
      store.setConnection('bluetooth', 'disconnected');
      store.addConsoleMessage('Bluetooth LE desconectado', 'info');
      
    } catch (error) {
      store.addConsoleMessage(`Error desconectando Bluetooth: ${error.message}`, 'error');
    }
  }

  isConnected() {
    return this.connected && this.device?.gatt?.connected;
  }

  // Obtener info del dispositivo
  getDeviceInfo() {
    if (!this.device) return null;
    
    return {
      type: 'bluetooth',
      name: this.device.name,
      id: this.device.id
    };
  }
}

export const bluetoothTransport = new BluetoothTransport();
