// OctoPrint Transport para Server3D - REST API + WebSocket
import { store } from '../store.js';

export class OctoPrintTransport {
  constructor() {
    this.baseUrl = null;
    this.apiKey = null;
    this.connected = false;
    this.websocket = null;
    this.printerState = 'unknown';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect(host, apiKey) {
    try {
      // Limpiar protocolo si existe y asegurar formato correcto
      const cleanHost = host.replace(/^https?:\/\//, '');
      this.baseUrl = `http://${cleanHost}`;
      this.apiKey = apiKey;
      
      store.setConnection('octoprint', 'connecting');
      store.addConsoleMessage(`Conectando a OctoPrint: ${this.baseUrl}`, 'info');
      
      // Verificar conexión con endpoint de versión
      const versionResponse = await this.makeRequest('GET', '/api/version');
      
      if (!versionResponse.api) {
        throw new Error('Respuesta inválida de OctoPrint');
      }
      
      store.addConsoleMessage(`OctoPrint ${versionResponse.server} (API ${versionResponse.api})`, 'info');
      
      // Verificar estado de la impresora
      await this.updatePrinterState();
      
      // Conectar WebSocket
      await this.connectWebSocket();
      
      this.connected = true;
      store.setConnection('octoprint', 'connected', { 
        host: this.baseUrl,
        version: versionResponse.server 
      });
      
      store.addConsoleMessage('Conectado a OctoPrint exitosamente', 'info');
      
      // Iniciar polling periódico como respaldo
      this.startStatusPolling();
      
      return true;
      
    } catch (error) {
      store.addConsoleMessage(`Error conectando OctoPrint: ${error.message}`, 'error');
      store.setConnection('octoprint', 'disconnected');
      await this.disconnect();
      return false;
    }
  }

  // Hacer petición HTTP a la API
  async makeRequest(method, endpoint, body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  }

  // Conectar WebSocket para updates en tiempo real
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.baseUrl.replace('http', 'ws') + '/sockjs/websocket';
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
          store.addConsoleMessage('WebSocket OctoPrint conectado', 'info');
          
          // Autenticar WebSocket
          this.websocket.send(JSON.stringify({
            auth: this.apiKey
          }));
          
          resolve();
        };
        
        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.warn('Error parseando mensaje WebSocket:', error);
          }
        };
        
        this.websocket.onclose = (event) => {
          store.addConsoleMessage('WebSocket OctoPrint desconectado', 'warning');
          this.handleWebSocketDisconnection();
        };
        
        this.websocket.onerror = (error) => {
          console.error('Error en WebSocket OctoPrint:', error);
          reject(error);
        };
        
        // Timeout para conexión
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

  // Manejar mensajes del WebSocket
  handleWebSocketMessage(data) {
    if (data.current) {
      // Actualizar temperaturas
      if (data.current.temps) {
        const temps = {};
        if (data.current.temps.tool0) {
          temps.hotend = {
            current: data.current.temps.tool0.actual,
            target: data.current.temps.tool0.target
          };
        }
        if (data.current.temps.bed) {
          temps.bed = {
            current: data.current.temps.bed.actual,
            target: data.current.temps.bed.target
          };
        }
        store.setTemperatures(temps);
      }
      
      // Actualizar estado de la impresora
      if (data.current.state) {
        this.printerState = data.current.state.text;
      }
    }
    
    // Manejar logs (respuestas de comandos)
    if (data.logs) {
      for (const log of data.logs) {
        store.addConsoleMessage(`< ${log}`, 'info');
        
        // Notificar al streamer si hay uno activo
        if (window.gcodeStreamer) {
          window.gcodeStreamer.handleResponse(log);
        }
      }
    }
  }

  // Manejar desconexión del WebSocket
  handleWebSocketDisconnection() {
    if (this.connected && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      store.addConsoleMessage(
        `Reintentando conexión WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 
        'warning'
      );
      
      setTimeout(() => {
        this.connectWebSocket().catch(() => {
          // Intentar de nuevo después de un delay
        });
      }, 5000 * this.reconnectAttempts);
    }
  }

  // Actualizar estado de la impresora
  async updatePrinterState() {
    try {
      const printerData = await this.makeRequest('GET', '/api/printer');
      
      // Actualizar temperaturas
      if (printerData.temperature) {
        const temps = {};
        if (printerData.temperature.tool0) {
          temps.hotend = {
            current: printerData.temperature.tool0.actual,
            target: printerData.temperature.tool0.target
          };
        }
        if (printerData.temperature.bed) {
          temps.bed = {
            current: printerData.temperature.bed.actual,
            target: printerData.temperature.bed.target
          };
        }
        store.setTemperatures(temps);
      }
      
      // Actualizar estado
      if (printerData.state) {
        this.printerState = printerData.state.text;
      }
      
    } catch (error) {
      console.warn('Error actualizando estado OctoPrint:', error);
    }
  }

  // Enviar comando G-code
  async sendCommand(command) {
    if (!this.connected) {
      throw new Error('OctoPrint no conectado');
    }
    
    try {
      const response = await this.makeRequest('POST', '/api/printer/command', {
        command: command.trim()
      });
      
      store.addConsoleMessage(`> ${command}`, 'info');
      
    } catch (error) {
      throw new Error(`Error enviando comando OctoPrint: ${error.message}`);
    }
  }

  // Subir archivo G-code
  async uploadFile(file) {
    if (!this.connected) {
      throw new Error('OctoPrint no conectado');
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('select', 'true'); // Auto-seleccionar
      
      const response = await fetch(`${this.baseUrl}/api/files/local`, {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      store.addConsoleMessage(`Archivo subido: ${result.files.local.name}`, 'info');
      
      return result;
      
    } catch (error) {
      throw new Error(`Error subiendo archivo: ${error.message}`);
    }
  }

  // Control de impresión
  async startPrint(filename = null) {
    if (!this.connected) {
      throw new Error('OctoPrint no conectado');
    }
    
    try {
      const body = { command: 'start' };
      if (filename) {
        // Si se especifica un archivo, seleccionarlo primero
        await this.makeRequest('POST', `/api/files/local/${filename}`, {
          command: 'select'
        });
      }
      
      await this.makeRequest('POST', '/api/job', body);
      store.addConsoleMessage('Impresión iniciada', 'info');
      
    } catch (error) {
      throw new Error(`Error iniciando impresión: ${error.message}`);
    }
  }

  async pausePrint() {
    if (!this.connected) return;
    
    try {
      await this.makeRequest('POST', '/api/job', { command: 'pause' });
      store.addConsoleMessage('Impresión pausada', 'info');
    } catch (error) {
      store.addConsoleMessage(`Error pausando: ${error.message}`, 'error');
    }
  }

  async resumePrint() {
    if (!this.connected) return;
    
    try {
      await this.makeRequest('POST', '/api/job', { command: 'pause' });
      store.addConsoleMessage('Impresión reanudada', 'info');
    } catch (error) {
      store.addConsoleMessage(`Error reanudando: ${error.message}`, 'error');
    }
  }

  async cancelPrint() {
    if (!this.connected) return;
    
    try {
      await this.makeRequest('POST', '/api/job', { command: 'cancel' });
      store.addConsoleMessage('Impresión cancelada', 'info');
    } catch (error) {
      store.addConsoleMessage(`Error cancelando: ${error.message}`, 'error');
    }
  }

  // Polling de estado como respaldo
  startStatusPolling() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    
    this.statusInterval = setInterval(async () => {
      if (this.connected && (!this.websocket || this.websocket.readyState !== WebSocket.OPEN)) {
        await this.updatePrinterState();
      }
    }, 10000); // Cada 10 segundos solo como respaldo
  }

  async disconnect() {
    try {
      this.connected = false;
      
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = null;
      }
      
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      this.baseUrl = null;
      this.apiKey = null;
      this.printerState = 'unknown';
      this.reconnectAttempts = 0;
      
      store.setConnection('octoprint', 'disconnected');
      store.addConsoleMessage('OctoPrint desconectado', 'info');
      
    } catch (error) {
      store.addConsoleMessage(`Error desconectando OctoPrint: ${error.message}`, 'error');
    }
  }

  isConnected() {
    return this.connected;
  }

  // Obtener info de la conexión
  getConnectionInfo() {
    return {
      type: 'octoprint',
      url: this.baseUrl,
      printerState: this.printerState,
      websocketConnected: this.websocket?.readyState === WebSocket.OPEN
    };
  }
}

export const octoPrintTransport = new OctoPrintTransport();
