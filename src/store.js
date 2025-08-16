// Store global para Server3D - Manejo de estado centralizado

export class Store {
  constructor() {
    this.state = {
      // Conexión
      connection: {
        type: null, // 'serial', 'bluetooth', 'octoprint', 'moonraker'
        status: 'disconnected', // 'disconnected', 'connecting', 'connected'
        device: null,
        config: {}
      },
      
      // Estado de la impresora
      printer: {
        temperatures: {
          hotend: { current: 0, target: 0 },
          bed: { current: 0, target: 0 }
        },
        position: { x: 0, y: 0, z: 0 },
        fanSpeed: 0,
        printSpeed: 100,
        state: 'idle' // 'idle', 'printing', 'paused', 'error'
      },
      
      // G-code streaming
      streaming: {
        active: false,
        currentFile: null,
        currentLine: 0,
        totalLines: 0,
        progress: 0,
        startTime: null,
        elapsedTime: 0,
        queue: [],
        buffer: []
      },
      
      // UI
      ui: {
        activeTab: 'connection',
        console: [],
        loading: false,
        lastUpdate: Date.now()
      },
      
      // Usuario Firebase
      user: {
        uid: null,
        connected: false
      }
    };

    this.listeners = new Map();
    this.middlewares = [];
  }

  // Obtener estado
  getState() {
    return { ...this.state };
  }

  // Obtener parte específica del estado
  get(path) {
    const keys = path.split('.');
    let current = this.state;
    
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    
    return current;
  }

  // Actualizar estado
  setState(updates) {
    const prevState = { ...this.state };
    
    // Aplicar updates
    this.state = this.deepMerge(this.state, updates);
    this.state.ui.lastUpdate = Date.now();
    
    // Aplicar middlewares
    for (const middleware of this.middlewares) {
      middleware(prevState, this.state, updates);
    }
    
    // Notificar listeners
    this.notifyListeners(prevState, this.state, updates);
    
    // Log en debug mode
    if (window.appConfig?.debug) {
      console.log('Store updated:', updates);
    }
  }

  // Actualizar conexión
  setConnection(type, status, device = null, config = {}) {
    this.setState({
      connection: {
        type,
        status,
        device,
        config: { ...this.state.connection.config, ...config }
      }
    });
  }

  // Actualizar temperaturas
  setTemperatures(temps) {
    this.setState({
      printer: {
        temperatures: {
          ...this.state.printer.temperatures,
          ...temps
        }
      }
    });
  }

  // Actualizar posición
  setPosition(position) {
    this.setState({
      printer: {
        position: { ...this.state.printer.position, ...position }
      }
    });
  }

  // Agregar mensaje al console
  addConsoleMessage(message, type = 'info') {
    const newMessage = {
      id: Date.now() + Math.random(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    
    const console = [...this.state.ui.console, newMessage];
    
    // Mantener solo últimos 100 mensajes
    if (console.length > 100) {
      console.shift();
    }
    
    this.setState({
      ui: { console }
    });
  }

  // Manejar streaming
  setStreaming(updates) {
    this.setState({
      streaming: { ...this.state.streaming, ...updates }
    });
  }

  // Agregar comando a la cola de streaming
  addToQueue(command) {
    const queue = [...this.state.streaming.queue, {
      id: Date.now() + Math.random(),
      command: command.trim(),
      status: 'pending', // 'pending', 'sent', 'acknowledged', 'error'
      sentAt: null,
      response: null
    }];
    
    this.setState({
      streaming: { queue }
    });
  }

  // Actualizar comando en la cola
  updateQueueCommand(id, updates) {
    const queue = this.state.streaming.queue.map(cmd =>
      cmd.id === id ? { ...cmd, ...updates } : cmd
    );
    
    this.setState({
      streaming: { queue }
    });
  }

  // Limpiar cola completada
  clearCompletedQueue() {
    const queue = this.state.streaming.queue.filter(cmd => 
      cmd.status === 'pending' || cmd.status === 'sent'
    );
    
    this.setState({
      streaming: { queue }
    });
  }

  // Cambiar tab activo
  setActiveTab(tab) {
    this.setState({
      ui: { activeTab: tab }
    });
  }

  // Mostrar/ocultar loading
  setLoading(loading) {
    this.setState({
      ui: { loading }
    });
  }

  // Suscribirse a cambios
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    
    this.listeners.get(path).add(callback);
    
    // Retornar función de unsubscribe
    return () => {
      const pathListeners = this.listeners.get(path);
      if (pathListeners) {
        pathListeners.delete(callback);
        if (pathListeners.size === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }

  // Notificar listeners
  notifyListeners(prevState, newState, updates) {
    for (const [path, callbacks] of this.listeners) {
      const prevValue = this.getValueFromPath(prevState, path);
      const newValue = this.getValueFromPath(newState, path);
      
      if (prevValue !== newValue) {
        for (const callback of callbacks) {
          try {
            callback(newValue, prevValue, updates);
          } catch (error) {
            console.error(`Error in listener for ${path}:`, error);
          }
        }
      }
    }
  }

  // Obtener valor por path
  getValueFromPath(obj, path) {
    if (path === '*') return obj;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    
    return current;
  }

  // Agregar middleware
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
  }

  // Deep merge objects
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  // Resetear estado
  reset() {
    this.state = {
      connection: { type: null, status: 'disconnected', device: null, config: {} },
      printer: {
        temperatures: { hotend: { current: 0, target: 0 }, bed: { current: 0, target: 0 } },
        position: { x: 0, y: 0, z: 0 },
        fanSpeed: 0,
        printSpeed: 100,
        state: 'idle'
      },
      streaming: {
        active: false,
        currentFile: null,
        currentLine: 0,
        totalLines: 0,
        progress: 0,
        startTime: null,
        elapsedTime: 0,
        queue: [],
        buffer: []
      },
      ui: {
        activeTab: 'connection',
        console: [],
        loading: false,
        lastUpdate: Date.now()
      },
      user: { uid: null, connected: false }
    };
  }

  // Debug info
  getDebugInfo() {
    return {
      state: this.state,
      listeners: Array.from(this.listeners.keys()),
      middlewares: this.middlewares.length
    };
  }
}

// Instancia global
export const store = new Store();

// Helper para logging
store.addMiddleware((prevState, newState, updates) => {
  if (updates.ui?.console) {
    // Logging a Firebase si está configurado
    if (window.fbClient && window.fbClient.isConnected()) {
      const lastMessage = newState.ui.console[newState.ui.console.length - 1];
      if (lastMessage && lastMessage.type === 'error') {
        window.fbClient.logError(lastMessage.message);
      }
    }
  }
});

// Helper para persistir configuración
store.addMiddleware((prevState, newState, updates) => {
  if (updates.connection?.config) {
    try {
      localStorage.setItem('server3d_connection_config', JSON.stringify(newState.connection.config));
    } catch (error) {
      console.warn('Could not save connection config:', error);
    }
  }
});

// Cargar configuración guardada al inicializar
try {
  const savedConfig = localStorage.getItem('server3d_connection_config');
  if (savedConfig) {
    store.setState({
      connection: { config: JSON.parse(savedConfig) }
    });
  }
} catch (error) {
  console.warn('Could not load saved config:', error);
}
