// USB Serial Transport para Server3D
import { store } from '../store.js';

export class SerialTransport {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.connected = false;
    this.baudRate = 115200;
  }

  // Verificar soporte Web Serial
  static isSupported() {
    return 'serial' in navigator;
  }

  // Conectar vía USB Serial
  async connect(baudRate = 115200) {
    try {
      if (!SerialTransport.isSupported()) {
        throw new Error('Web Serial API no soportada en este navegador');
      }

      // Solicitar puerto
      this.port = await navigator.serial.requestPort();
      
      // Abrir puerto
      await this.port.open({ 
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      this.baudRate = baudRate;
      this.connected = true;

      // Configurar reader/writer
      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();

      store.setConnection('serial', 'connected', { baudRate });
      store.addConsoleMessage(`Conectado via Serial (${baudRate} baud)`, 'info');

      // Iniciar lectura de datos
      this.startReading();

      // Handshake inicial
      await this.sendCommand('M115'); // Firmware info
      
      // Iniciar query periódico de temperatura
      this.startTemperaturePolling();

      return true;
    } catch (error) {
      store.addConsoleMessage(`Error conectando Serial: ${error.message}`, 'error');
      store.setConnection('serial', 'disconnected');
      return false;
    }
  }

  // Leer datos del puerto
  async startReading() {
    try {
      while (this.connected && this.reader) {
        const { value, done } = await this.reader.read();
        
        if (done) break;
        
        const text = new TextDecoder().decode(value);
        const lines = text.split('\n');
        
        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine) {
            this.handleResponse(cleanLine);
          }
        }
      }
    } catch (error) {
      if (this.connected) {
        store.addConsoleMessage(`Error leyendo Serial: ${error.message}`, 'error');
        this.disconnect();
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
    
    // Notificar al streamer si hay uno activo
    if (window.gcodeStreamer) {
      window.gcodeStreamer.handleResponse(response);
    }
  }

  // Parsear respuesta de temperatura (M105)
  parseTemperatureResponse(response) {
    if (response.startsWith('T:') || response.includes('T:')) {
      // Formato típico: T:190.0 /200.0 B:60.0 /60.0
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

  // Parsear respuesta de posición (M114)
  parsePositionResponse(response) {
    if (response.startsWith('X:') || response.includes('X:')) {
      // Formato: X:0.00 Y:0.00 Z:0.00 E:0.00
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
    if (!this.connected || !this.writer) {
      throw new Error('Puerto serial no conectado');
    }

    const commandWithNewline = command.trim() + '\n';
    const data = new TextEncoder().encode(commandWithNewline);
    
    await this.writer.write(data);
    store.addConsoleMessage(`> ${command}`, 'info');
  }

  // Query periódico de temperatura
  startTemperaturePolling() {
    if (this.tempInterval) {
      clearInterval(this.tempInterval);
    }
    
    this.tempInterval = setInterval(async () => {
      if (this.connected) {
        try {
          await this.sendCommand('M105');
        } catch (error) {
          console.error('Error en temperature polling:', error);
        }
      }
    }, window.appConfig?.tempQueryInterval || 3000);
  }

  // Desconectar
  async disconnect() {
    try {
      this.connected = false;
      
      if (this.tempInterval) {
        clearInterval(this.tempInterval);
        this.tempInterval = null;
      }
      
      if (this.reader) {
        await this.reader.cancel();
        await this.reader.releaseLock();
        this.reader = null;
      }
      
      if (this.writer) {
        await this.writer.releaseLock();
        this.writer = null;
      }
      
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
      
      store.setConnection('serial', 'disconnected');
      store.addConsoleMessage('Desconectado de puerto Serial', 'info');
      
    } catch (error) {
      store.addConsoleMessage(`Error desconectando Serial: ${error.message}`, 'error');
    }
  }

  // Verificar si está conectado
  isConnected() {
    return this.connected && this.port;
  }

  // Obtener info del dispositivo
  getDeviceInfo() {
    if (!this.port) return null;
    
    return {
      type: 'serial',
      baudRate: this.baudRate,
      productId: this.port.getInfo()?.usbProductId,
      vendorId: this.port.getInfo()?.usbVendorId
    };
  }

  // Configurar baudrate
  async setBaudRate(newBaudRate) {
    if (this.connected) {
      await this.disconnect();
    }
    
    this.baudRate = newBaudRate;
    
    if (this.port) {
      return this.connect(newBaudRate);
    }
  }
}

export const serialTransport = new SerialTransport();
