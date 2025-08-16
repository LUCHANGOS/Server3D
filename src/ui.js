// UI Manager para Server3D
import { store } from './store.js';

export class UIManager {
  constructor() {
    this.elements = {};
    this.currentTab = 'connection';
  }

  // Inicializar UI
  init() {
    this.bindElements();
    this.setupEventListeners();
    this.setupStoreSubscriptions();
    
    // Actualizar display inicial
    this.updateConnectionStatus();
    this.updateUI();
    
    console.log('UI Manager iniciado');
  }

  // Enlazar elementos del DOM
  bindElements() {
    // Navigation
    this.elements.tabBtns = document.querySelectorAll('.tab-btn');
    this.elements.tabContents = document.querySelectorAll('.tab-content');
    
    // Status
    this.elements.connectionStatus = document.getElementById('connection-status');
    this.elements.statusIndicator = this.elements.connectionStatus?.querySelector('.status-indicator');
    this.elements.statusText = this.elements.connectionStatus?.querySelector('.status-text');
    
    // Controls
    this.elements.aiCommandInput = document.getElementById('ai-command');
    this.elements.sendAiCommand = document.getElementById('send-ai-command');
    this.elements.consoleLog = document.getElementById('console-log');
    this.elements.manualGcode = document.getElementById('manual-gcode');
    this.elements.sendGcode = document.getElementById('send-gcode');
    
    // Connection buttons
    this.elements.connectUsb = document.getElementById('connect-usb');
    this.elements.connectBle = document.getElementById('connect-ble');
    
    // Temperature displays
    this.elements.currentHotendTemp = document.getElementById('current-hotend-temp');
    this.elements.currentBedTemp = document.getElementById('current-bed-temp');
    this.elements.targetHotendTemp = document.getElementById('target-hotend-temp');
    this.elements.targetBedTemp = document.getElementById('target-bed-temp');
    
    // Position displays
    this.elements.posX = document.getElementById('pos-x');
    this.elements.posY = document.getElementById('pos-y');
    this.elements.posZ = document.getElementById('pos-z');
    
    // Temperature controls
    this.elements.hotendTemp = document.getElementById('hotend-temp');
    this.elements.hotendTempValue = document.getElementById('hotend-temp-value');
    this.elements.setHotendTemp = document.getElementById('set-hotend-temp');
    
    // Progress
    this.elements.progressFill = document.getElementById('progress-fill');
    this.elements.progressText = document.getElementById('progress-text');
    
    // G-code file handling
    this.elements.gcodeFile = document.getElementById('gcode-file');
    this.elements.fileInfo = document.getElementById('file-info');
    this.elements.gcodePreview = document.getElementById('gcode-preview-content');
    this.elements.startGcodeStream = document.getElementById('start-gcode-stream');
    this.elements.stopGcodeStream = document.getElementById('stop-gcode-stream');
  }

  // Configurar event listeners
  setupEventListeners() {
    // Tab navigation
    this.elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // AI Command
    if (this.elements.sendAiCommand) {
      this.elements.sendAiCommand.addEventListener('click', () => {
        this.handleAICommand();
      });
    }

    if (this.elements.aiCommandInput) {
      this.elements.aiCommandInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleAICommand();
        }
      });
    }

    // Manual G-code
    if (this.elements.sendGcode) {
      this.elements.sendGcode.addEventListener('click', () => {
        this.handleManualGcode();
      });
    }

    // Connection buttons
    if (this.elements.connectUsb) {
      this.elements.connectUsb.addEventListener('click', async () => {
        const baudRate = document.getElementById('baud-rate')?.value || '115200';
        await this.handleUSBConnect(parseInt(baudRate));
      });
    }

    if (this.elements.connectBle) {
      this.elements.connectBle.addEventListener('click', async () => {
        await this.handleBLEConnect();
      });
    }

    // OctoPrint connection
    if (document.getElementById('connect-octoprint')) {
      document.getElementById('connect-octoprint').addEventListener('click', async () => {
        const host = document.getElementById('octoprint-host')?.value.trim();
        const apiKey = document.getElementById('octoprint-key')?.value.trim();
        if (host && apiKey) {
          await this.handleOctoPrintConnect(host, apiKey);
        } else {
          store.addConsoleMessage('Introduce host y API key de OctoPrint', 'warning');
        }
      });
    }

    // Moonraker connection
    if (document.getElementById('connect-moonraker')) {
      document.getElementById('connect-moonraker').addEventListener('click', async () => {
        const host = document.getElementById('moonraker-host')?.value.trim();
        if (host) {
          await this.handleMoonrakerConnect(host);
        } else {
          store.addConsoleMessage('Introduce host de Moonraker', 'warning');
        }
      });
    }

    // Temperature sliders
    if (this.elements.hotendTemp) {
      this.elements.hotendTemp.addEventListener('input', (e) => {
        if (this.elements.hotendTempValue) {
          this.elements.hotendTempValue.textContent = `${e.target.value}°C`;
        }
      });
    }

    // Set temperature buttons
    if (this.elements.setHotendTemp) {
      this.elements.setHotendTemp.addEventListener('click', () => {
        const temp = this.elements.hotendTemp?.value;
        if (temp && window.currentTransport) {
          window.currentTransport.sendCommand(`M104 S${temp}`);
        }
      });
    }

    // G-code file handling
    if (this.elements.gcodeFile) {
      this.elements.gcodeFile.addEventListener('change', (e) => {
        this.handleGcodeFileLoad(e.target.files[0]);
      });
    }

    if (this.elements.startGcodeStream) {
      this.elements.startGcodeStream.addEventListener('click', () => {
        this.handleStartStreaming();
      });
    }

    if (this.elements.stopGcodeStream) {
      this.elements.stopGcodeStream.addEventListener('click', () => {
        this.handleStopStreaming();
      });
    }
  }

  // Suscripciones al store
  setupStoreSubscriptions() {
    // Connection status
    store.subscribe('connection.status', (status) => {
      this.updateConnectionStatus();
    });

    // Console messages
    store.subscribe('ui.console', (messages) => {
      this.updateConsole(messages);
    });

    // Temperatures
    store.subscribe('printer.temperatures', (temps) => {
      this.updateTemperatureDisplay(temps);
    });

    // Position
    store.subscribe('printer.position', (position) => {
      this.updatePositionDisplay(position);
    });

    // Streaming progress
    store.subscribe('streaming', (streaming) => {
      this.updateProgressDisplay(streaming);
    });
  }

  // Cambiar tab
  switchTab(tab) {
    // Update tab buttons
    this.elements.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update tab content
    this.elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `${tab}-tab`);
    });

    this.currentTab = tab;
    store.setActiveTab(tab);
  }

  // Manejar comando AI
  async handleAICommand() {
    const input = this.elements.aiCommandInput?.value.trim();
    if (!input) return;

    try {
      const { intentParser } = await import('./intents.js');
      const parsed = intentParser.parseCommand(input);
      
      if (parsed.type === 'error' || parsed.type === 'unknown') {
        store.addConsoleMessage(`IA: ${parsed.error}`, 'error');
        if (parsed.suggestion) {
          store.addConsoleMessage(`IA: ${parsed.suggestion}`, 'info');
        }
        return;
      }

      store.addConsoleMessage(`IA: ${parsed.description}`, 'info');
      
      if (parsed.gcode && window.currentTransport) {
        const commands = parsed.gcode.split('\n');
        for (const cmd of commands) {
          if (cmd.trim()) {
            await window.currentTransport.sendCommand(cmd.trim());
          }
        }
      }

      this.elements.aiCommandInput.value = '';
      
    } catch (error) {
      store.addConsoleMessage(`Error procesando comando: ${error.message}`, 'error');
    }
  }

  // Manejar G-code manual
  async handleManualGcode() {
    const command = this.elements.manualGcode?.value.trim();
    if (!command || !window.currentTransport) return;

    try {
      await window.currentTransport.sendCommand(command);
      this.elements.manualGcode.value = '';
    } catch (error) {
      store.addConsoleMessage(`Error enviando comando: ${error.message}`, 'error');
    }
  }

  // Manejar conexión USB
  async handleUSBConnect(baudRate) {
    try {
      store.setLoading(true);
      const { serialTransport } = await import('./transports/serial.js');
      
      const success = await serialTransport.connect(baudRate);
      if (success) {
        window.currentTransport = serialTransport;
      }
    } catch (error) {
      store.addConsoleMessage(`Error conectando USB: ${error.message}`, 'error');
    } finally {
      store.setLoading(false);
    }
  }

  // Manejar conexión Bluetooth LE
  async handleBLEConnect() {
    try {
      store.setLoading(true);
      const { bluetoothTransport } = await import('./transports/bluetooth.js');
      
      const success = await bluetoothTransport.connect();
      if (success) {
        window.currentTransport = bluetoothTransport;
      }
    } catch (error) {
      store.addConsoleMessage(`Error conectando Bluetooth: ${error.message}`, 'error');
    } finally {
      store.setLoading(false);
    }
  }

  // Manejar conexión OctoPrint
  async handleOctoPrintConnect(host, apiKey) {
    try {
      store.setLoading(true);
      const { octoPrintTransport } = await import('./transports/octoprint.js');
      
      const success = await octoPrintTransport.connect(host, apiKey);
      if (success) {
        window.currentTransport = octoPrintTransport;
      }
    } catch (error) {
      store.addConsoleMessage(`Error conectando OctoPrint: ${error.message}`, 'error');
    } finally {
      store.setLoading(false);
    }
  }

  // Manejar conexión Moonraker
  async handleMoonrakerConnect(host) {
    try {
      store.setLoading(true);
      const { moonrakerTransport } = await import('./transports/moonraker.js');
      
      const success = await moonrakerTransport.connect(host);
      if (success) {
        window.currentTransport = moonrakerTransport;
      }
    } catch (error) {
      store.addConsoleMessage(`Error conectando Moonraker: ${error.message}`, 'error');
    } finally {
      store.setLoading(false);
    }
  }

  // Actualizar status de conexión
  updateConnectionStatus() {
    const connection = store.get('connection');
    if (!this.elements.statusIndicator || !this.elements.statusText) return;

    this.elements.statusIndicator.className = 'status-indicator';
    
    switch (connection.status) {
      case 'connected':
        this.elements.statusIndicator.classList.add('connected');
        this.elements.statusText.textContent = `Conectado (${connection.type})`;
        break;
      case 'connecting':
        this.elements.statusIndicator.classList.add('connecting');
        this.elements.statusText.textContent = 'Conectando...';
        break;
      default:
        this.elements.statusText.textContent = 'Desconectado';
    }
  }

  // Actualizar console
  updateConsole(messages) {
    if (!this.elements.consoleLog) return;

    this.elements.consoleLog.innerHTML = '';
    
    messages.slice(-50).forEach(msg => {
      const div = document.createElement('div');
      div.className = `console-message ${msg.type}`;
      div.innerHTML = `<span class="timestamp">[${msg.timestamp}]</span> ${msg.message}`;
      this.elements.consoleLog.appendChild(div);
    });
    
    this.elements.consoleLog.scrollTop = this.elements.consoleLog.scrollHeight;
  }

  // Actualizar display de temperatura
  updateTemperatureDisplay(temps) {
    if (this.elements.currentHotendTemp && temps.hotend) {
      this.elements.currentHotendTemp.textContent = `${temps.hotend.current}°C`;
    }
    if (this.elements.targetHotendTemp && temps.hotend) {
      this.elements.targetHotendTemp.textContent = temps.hotend.target;
    }
    if (this.elements.currentBedTemp && temps.bed) {
      this.elements.currentBedTemp.textContent = `${temps.bed.current}°C`;
    }
    if (this.elements.targetBedTemp && temps.bed) {
      this.elements.targetBedTemp.textContent = temps.bed.target;
    }
  }

  // Actualizar display de posición
  updatePositionDisplay(position) {
    if (this.elements.posX && position.x !== undefined) {
      this.elements.posX.textContent = position.x.toFixed(2);
    }
    if (this.elements.posY && position.y !== undefined) {
      this.elements.posY.textContent = position.y.toFixed(2);
    }
    if (this.elements.posZ && position.z !== undefined) {
      this.elements.posZ.textContent = position.z.toFixed(2);
    }
  }

  // Actualizar display de progreso
  updateProgressDisplay(streaming) {
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${streaming.progress || 0}%`;
    }
    if (this.elements.progressText) {
      this.elements.progressText.textContent = 
        `${streaming.progress || 0}% (${streaming.currentLine || 0}/${streaming.totalLines || 0} líneas)`;
    }
  }

  // Actualizar UI general
  updateUI() {
    const loading = store.get('ui.loading');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    if (loadingOverlay) {
      loadingOverlay.classList.toggle('hidden', !loading);
    }
  }

  // Manejar carga de archivo G-code
  async handleGcodeFileLoad(file) {
    if (!file) return;

    try {
      const { Validator } = await import('./utils/validate.js');
      const validation = Validator.validateGcodeFile(file);
      
      if (!validation.valid) {
        store.addConsoleMessage(`Error: ${validation.error}`, 'error');
        return;
      }

      // Mostrar información del archivo
      if (this.elements.fileInfo) {
        this.elements.fileInfo.textContent = `${file.name} (${(file.size/1024).toFixed(1)} KB)`;
      }

      // Leer contenido
      const content = await this.readFileContent(file);
      
      // Cargar en el streamer
      const { gcodeStreamer } = await import('./gcodeStreamer.js');
      const success = await gcodeStreamer.loadFile(file, content);
      
      if (success) {
        // Mostrar preview
        const { GcodeParser } = await import('./utils/gcode.js');
        const preview = GcodeParser.getPreview(content, 20);
        
        if (this.elements.gcodePreview) {
          this.elements.gcodePreview.textContent = preview;
        }
        
        // Habilitar botón de streaming
        if (this.elements.startGcodeStream) {
          this.elements.startGcodeStream.disabled = false;
        }
      }
      
    } catch (error) {
      store.addConsoleMessage(`Error cargando archivo: ${error.message}`, 'error');
    }
  }

  // Leer contenido del archivo
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      
      reader.readAsText(file);
    });
  }

  // Iniciar streaming
  async handleStartStreaming() {
    if (!window.currentTransport?.isConnected()) {
      store.addConsoleMessage('No hay conexión activa para streaming', 'warning');
      return;
    }

    try {
      const { gcodeStreamer } = await import('./gcodeStreamer.js');
      await gcodeStreamer.start(window.currentTransport);
      
      // Deshabilitar botón start, habilitar stop
      if (this.elements.startGcodeStream) {
        this.elements.startGcodeStream.disabled = true;
      }
      if (this.elements.stopGcodeStream) {
        this.elements.stopGcodeStream.disabled = false;
      }
      
    } catch (error) {
      store.addConsoleMessage(`Error iniciando streaming: ${error.message}`, 'error');
    }
  }

  // Detener streaming
  async handleStopStreaming() {
    try {
      const { gcodeStreamer } = await import('./gcodeStreamer.js');
      gcodeStreamer.stop();
      
      // Habilitar botón start, deshabilitar stop
      if (this.elements.startGcodeStream) {
        this.elements.startGcodeStream.disabled = false;
      }
      if (this.elements.stopGcodeStream) {
        this.elements.stopGcodeStream.disabled = true;
      }
      
    } catch (error) {
      store.addConsoleMessage(`Error deteniendo streaming: ${error.message}`, 'error');
    }
  }

  // Mostrar notificación
  showNotification(message, type = 'info', duration = 3000) {
    // Simple implementation - could be enhanced with toast notifications
    console.log(`Notification [${type}]: ${message}`);
    store.addConsoleMessage(message, type);
  }
}

export const uiManager = new UIManager();
