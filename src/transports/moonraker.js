// Moonraker Transport para Server3D - Klipper API via WebSocket
import { store } from '../store.js';

export class MoonrakerTransport {
  constructor() {
    this.baseUrl = null;
    this.websocket = null;
    this.connected = false;
    this.requestId = 1;
    this.pendingRequests = new Map();
    this.klipperState = 'unknown';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect(host) {
    try {
      // Limpiar protocolo y asegurar formato
      const cleanHost = host.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
      this.baseUrl = `http://${cleanHost}`;
      
      store.setConnection('moonraker', 'connecting');
      store.addConsoleMessage(`Conectando a Moonraker: ${this.baseUrl}`, 'info');
      
      // Verificar conexión con REST API primero
      await this.testRestConnection();
      
      // Conectar WebSocket
      await this.connectWebSocket();
      
      // Obtener estado inicial de Klipper
      await this.getKlipperState();
      
      // Suscribirse a actualizaciones
      await this.subscribeToUpdates();
      
      this.connected = true;
      store.setConnection('moonraker', 'connected', { host: this.baseUrl });
      store.addConsoleMessage('Conectado a Moonraker exitosamente', 'info');
      
      return true;
      
    } catch (error) {
      store.addConsoleMessage(`Error conectando Moonraker: ${error.message}`, 'error');
      store.setConnection('moonraker', 'disconnected');
      await this.disconnect();
      return false;
    }
  }

  // Probar conexión REST
  async testRestConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/server/info`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      store.addConsoleMessage(`Moonraker ${data.result.moonraker_version}`, 'info');
      
    } catch (error) {
      throw new Error(`Error verificando Moonraker: ${error.message}`);
    }
  }

  // Conectar WebSocket
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.baseUrl.replace('http', 'ws') + '/websocket';
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
          store.addConsoleMessage('WebSocket Moonraker conectado', 'info');
          resolve();
        };
        
        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.warn('Error parseando mensaje Moonraker:', error);
          }
        };
        
        this.websocket.onclose = () => {
          store.addConsoleMessage('WebSocket Moonraker desconectado', 'warning');
          this.handleWebSocketDisconnection();
        };
        
        this.websocket.onerror = (error) => {
          console.error('Error en WebSocket Moonraker:', error);
          reject(error);
        };
        
        // Timeout
        setTimeout(() => {
          if (this.websocket.readyState !== WebSocket.OPEN) {
            this.websocket.close();
            reject(new Error('Timeout conectando WebSocket'));
          }
        }, 10000);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  // Manejar mensajes WebSocket
  handleWebSocketMessage(data) {
    // Respuestas a peticiones
    if (data.id && this.pendingRequests.has(data.id)) {
      const { resolve, reject } = this.pendingRequests.get(data.id);
      this.pendingRequests.delete(data.id);
      
      if (data.error) {
        reject(new Error(data.error.message));
      } else {
        resolve(data.result);
      }
      return;
    }
    
    // Notificaciones (actualizaciones de estado)
    if (data.method && data.params) {
      this.handleNotification(data.method, data.params[0]);
    }
  }

  // Manejar notificaciones
  handleNotification(method, params) {
    switch (method) {
      case 'notify_status_update':
        this.handleStatusUpdate(params);
        break;
        
      case 'notify_klippy_ready':
        this.klipperState = 'ready';
        store.addConsoleMessage('Klipper listo', 'info');
        break;
        
      case 'notify_klippy_shutdown':
        this.klipperState = 'shutdown';
        store.addConsoleMessage('Klipper en shutdown', 'warning');
        break;
        
      case 'notify_klippy_disconnected':
        this.klipperState = 'disconnected';
        store.addConsoleMessage('Klipper desconectado', 'warning');
        break;
        
      case 'notify_gcode_response':
        // Respuesta de comando G-code
        store.addConsoleMessage(`< ${params}`, 'info');
        
        // Notificar al streamer
        if (window.gcodeStreamer) {
          window.gcodeStreamer.handleResponse(params);
        }
        break;
    }
  }

  // Manejar actualización de estado
  handleStatusUpdate(status) {
    // Temperaturas
    if (status.extruder || status.heater_bed) {
      const temps = {};
      
      if (status.extruder) {
        temps.hotend = {
          current: status.extruder.temperature,
          target: status.extruder.target
        };
      }
      
      if (status.heater_bed) {
        temps.bed = {
          current: status.heater_bed.temperature,
          target: status.heater_bed.target
        };
      }
      
      store.setTemperatures(temps);
    }
    
    // Posición del cabezal
    if (status.toolhead) {
      const position = {};
      if (status.toolhead.position) {
        position.x = status.toolhead.position[0];
        position.y = status.toolhead.position[1];
        position.z = status.toolhead.position[2];
        store.setPosition(position);
      }
    }
    
    // Estado del ventilador
    if (status.fan && status.fan.speed !== undefined) {
      const fanSpeed = Math.round(status.fan.speed * 100);
      store.setState({
        printer: {
          fanSpeed
        }
      });
    }
  }

  // Hacer petición via WebSocket
  async makeRequest(method, params = {}) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket no conectado');
    }
    
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      
      this.pendingRequests.set(id, { resolve, reject });
      
      this.websocket.send(JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id
      }));
      
      // Timeout para la petición
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Timeout en petición'));
        }
      }, 10000);
    });
  }

  // Obtener estado de Klipper
  async getKlipperState() {
    try {
      const result = await this.makeRequest('printer.objects.query', {
        objects: {
          extruder: ['temperature', 'target'],
          heater_bed: ['temperature', 'target'],
          toolhead: ['position'],
          fan: ['speed'],
          print_stats: ['state']
        }
      });
      
      this.handleStatusUpdate(result.status);
      
      if (result.status.print_stats) {
        this.klipperState = result.status.print_stats.state;
      }
      
    } catch (error) {
      console.warn('Error obteniendo estado Klipper:', error);
    }
  }

  // Suscribirse a actualizaciones
  async subscribeToUpdates() {
    try {
      await this.makeRequest('printer.objects.subscribe', {
        objects: {
          extruder: ['temperature', 'target'],
          heater_bed: ['temperature', 'target'],
          toolhead: ['position'],
          fan: ['speed'],
          print_stats: ['state']
        }
      });
      
      // Suscribirse a respuestas G-code
      await this.makeRequest('server.gcode_store.subscribe');
      
    } catch (error) {
      console.warn('Error suscribiéndose a actualizaciones:', error);
    }
  }

  // Enviar comando G-code
  async sendCommand(command) {
    if (!this.connected) {
      throw new Error('Moonraker no conectado');
    }
    
    try {
      await this.makeRequest('printer.gcode.script', {
        script: command.trim()
      });
      
      store.addConsoleMessage(`> ${command}`, 'info');
      
    } catch (error) {
      throw new Error(`Error enviando comando: ${error.message}`);
    }
  }

  // Control de impresión
  async startPrint(filename) {
    if (!this.connected) {
      throw new Error('Moonraker no conectado');
    }
    
    try {
      await this.makeRequest('printer.print.start', {
        filename: filename
      });
      store.addConsoleMessage(`Impresión iniciada: ${filename}`, 'info');
    } catch (error) {
      throw new Error(`Error iniciando impresión: ${error.message}`);
    }
  }

  async pausePrint() {
    if (!this.connected) return;
    
    try {
      await this.makeRequest('printer.print.pause');
      store.addConsoleMessage('Impresión pausada', 'info');
    } catch (error) {
      store.addConsoleMessage(`Error pausando: ${error.message}`, 'error');
    }
  }

  async resumePrint() {
    if (!this.connected) return;
    
    try {
      await this.makeRequest('printer.print.resume');
      store.addConsoleMessage('Impresión reanudada', 'info');
    } catch (error) {
      store.addConsoleMessage(`Error reanudando: ${error.message}`, 'error');
    }
  }

  async cancelPrint() {
    if (!this.connected) return;
    
    try {
      await this.makeRequest('printer.print.cancel');
      store.addConsoleMessage('Impresión cancelada', 'info');
    } catch (error) {
      store.addConsoleMessage(`Error cancelando: ${error.message}`, 'error');
    }
  }

  // Subir archivo
  async uploadFile(file) {
    if (!this.connected) {
      throw new Error('Moonraker no conectado');
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('root', 'gcodes');
      
      const response = await fetch(`${this.baseUrl}/server/files/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      store.addConsoleMessage(`Archivo subido: ${result.result.item.path}`, 'info');
      
      return result;
      
    } catch (error) {
      throw new Error(`Error subiendo archivo: ${error.message}`);
    }
  }

  // Emergency stop
  async emergencyStop() {
    if (!this.connected) return;
    
    try {
      await this.makeRequest('printer.emergency_stop');
      store.addConsoleMessage('🚨 PARADA DE EMERGENCIA', 'error');
    } catch (error) {
      store.addConsoleMessage(`Error en parada de emergencia: ${error.message}`, 'error');
    }
  }

  // Restart Klipper firmware
  async restartFirmware() {
    if (!this.connected) return;
    
    try {
      await this.makeRequest('printer.firmware_restart');
      store.addConsoleMessage('Reiniciando firmware Klipper...', 'info');
    } catch (error) {
      store.addConsoleMessage(`Error reiniciando firmware: ${error.message}`, 'error');
    }
  }

  // Manejar desconexión
  handleWebSocketDisconnection() {
    if (this.connected && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      store.addConsoleMessage(
        `Reintentando conexión Moonraker (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
        'warning'
      );
      
      setTimeout(() => {
        this.connectWebSocket().catch(() => {
          // Intentar de nuevo
        });
      }, 5000 * this.reconnectAttempts);
    }
  }

  async disconnect() {
    try {
      this.connected = false;
      
      // Limpiar peticiones pendientes
      for (const [id, { reject }] of this.pendingRequests) {
        reject(new Error('Desconectado'));
      }
      this.pendingRequests.clear();
      
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      this.baseUrl = null;
      this.klipperState = 'unknown';
      this.reconnectAttempts = 0;
      this.requestId = 1;
      
      store.setConnection('moonraker', 'disconnected');
      store.addConsoleMessage('Moonraker desconectado', 'info');
      
    } catch (error) {
      store.addConsoleMessage(`Error desconectando Moonraker: ${error.message}`, 'error');
    }
  }

  isConnected() {
    return this.connected && this.websocket?.readyState === WebSocket.OPEN;
  }

  // Obtener info de la conexión
  getConnectionInfo() {
    return {
      type: 'moonraker',
      url: this.baseUrl,
      klipperState: this.klipperState,
      websocketConnected: this.websocket?.readyState === WebSocket.OPEN,
      pendingRequests: this.pendingRequests.size
    };
  }
}

export const moonrakerTransport = new MoonrakerTransport();
