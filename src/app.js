// Aplicación principal Server3D
import { store } from './store.js';
import { uiManager } from './ui.js';
import { gcodeStreamer } from './gcodeStreamer.js';

class Server3DApp {
  constructor() {
    this.version = '1.0.0';
    this.initialized = false;
  }

  // Inicializar aplicación
  async init() {
    try {
      console.log(`🖨️ Server3D v${this.version} iniciando...`);
      
      // Verificar compatibilidad del navegador
      this.checkBrowserSupport();
      
      // Inicializar UI Manager
      uiManager.init();
      
      // Hacer disponibles globalmente algunos objetos
      window.store = store;
      window.gcodeStreamer = gcodeStreamer;
      window.currentTransport = null;
      
      // Configurar manejadores globales
      this.setupGlobalHandlers();
      
      // Mensaje de bienvenida
      store.addConsoleMessage(`Server3D v${this.version} iniciado correctamente`, 'info');
      store.addConsoleMessage('Selecciona un tipo de conexión para comenzar', 'info');
      
      // Log de soporte del navegador
      this.logBrowserSupport();
      
      this.initialized = true;
      
      console.log('✅ Server3D iniciado correctamente');
      
    } catch (error) {
      console.error('❌ Error iniciando Server3D:', error);
      store.addConsoleMessage(`Error iniciando aplicación: ${error.message}`, 'error');
    }
  }

  // Verificar soporte del navegador
  checkBrowserSupport() {
    const features = {
      webSerial: 'serial' in navigator,
      webBluetooth: 'bluetooth' in navigator,
      serviceWorker: 'serviceWorker' in navigator,
      webAssembly: 'WebAssembly' in window,
      es6Modules: true // Si llegamos aquí, es que soporta modules
    };

    // Advertencias para características no soportadas
    if (!features.webSerial) {
      console.warn('Web Serial API no soportada - conexiones USB no disponibles');
    }
    
    if (!features.webBluetooth) {
      console.warn('Web Bluetooth API no soportada - conexiones BLE no disponibles');
    }
    
    return features;
  }

  // Log de soporte del navegador
  logBrowserSupport() {
    const ua = navigator.userAgent;
    const isChrome = ua.includes('Chrome');
    const isEdge = ua.includes('Edg');
    const isFirefox = ua.includes('Firefox');
    const isSafari = ua.includes('Safari') && !isChrome;

    let browserName = 'Desconocido';
    if (isChrome) browserName = 'Chrome';
    else if (isEdge) browserName = 'Edge';
    else if (isFirefox) browserName = 'Firefox';
    else if (isSafari) browserName = 'Safari';

    store.addConsoleMessage(`Navegador: ${browserName}`, 'info');
    
    // Características soportadas
    const features = [];
    if ('serial' in navigator) features.push('USB Serial');
    if ('bluetooth' in navigator) features.push('Bluetooth LE');
    if ('serviceWorker' in navigator) features.push('PWA');
    
    if (features.length > 0) {
      store.addConsoleMessage(`Características: ${features.join(', ')}`, 'info');
    } else {
      store.addConsoleMessage('Navegador con soporte limitado', 'warning');
    }
  }

  // Configurar manejadores globales
  setupGlobalHandlers() {
    // Manejar errores no capturados
    window.addEventListener('error', (event) => {
      console.error('Error no capturado:', event.error);
      store.addConsoleMessage(`Error: ${event.error?.message || 'Error desconocido'}`, 'error');
      
      // Reportar a Firebase si está disponible
      if (window.fbClient?.isConnected()) {
        window.fbClient.logError(event.error?.message || 'Uncaught error', {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      }
    });

    // Manejar promesas rechazadas
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Promesa rechazada:', event.reason);
      store.addConsoleMessage(`Error async: ${event.reason?.message || event.reason}`, 'error');
      
      if (window.fbClient?.isConnected()) {
        window.fbClient.logError(`Unhandled promise rejection: ${event.reason}`);
      }
    });

    // Manejar visibilidad de la página
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('Aplicación en background');
      } else {
        console.log('Aplicación activa');
        // Actualizar estado cuando vuelve a estar visible
        this.refreshStatus();
      }
    });

    // Configurar atajos de teclado
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+C: Limpiar console
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        store.setState({ ui: { console: [] } });
        store.addConsoleMessage('Console limpiado', 'info');
      }
      
      // Escape: Parada de emergencia
      if (event.key === 'Escape' && window.currentTransport) {
        event.preventDefault();
        this.emergencyStop();
      }
    });
  }

  // Refrescar estado
  async refreshStatus() {
    if (window.currentTransport?.isConnected()) {
      try {
        await window.currentTransport.sendCommand('M105'); // Temperatura
        await window.currentTransport.sendCommand('M114'); // Posición
      } catch (error) {
        console.error('Error actualizando estado:', error);
      }
    }
  }

  // Parada de emergencia
  async emergencyStop() {
    if (!window.currentTransport?.isConnected()) {
      store.addConsoleMessage('No hay conexión activa para parada de emergencia', 'warning');
      return;
    }

    try {
      await window.currentTransport.sendCommand('M112'); // Emergency stop
      await window.currentTransport.sendCommand('M104 S0'); // Hotend off
      await window.currentTransport.sendCommand('M140 S0'); // Bed off
      await window.currentTransport.sendCommand('M107'); // Fan off
      
      // Detener streaming si está activo
      if (gcodeStreamer.isStreaming) {
        gcodeStreamer.stop();
      }
      
      store.addConsoleMessage('🚨 PARADA DE EMERGENCIA EJECUTADA', 'error');
      
    } catch (error) {
      store.addConsoleMessage(`Error en parada de emergencia: ${error.message}`, 'error');
    }
  }

  // Obtener información de la aplicación
  getInfo() {
    return {
      version: this.version,
      initialized: this.initialized,
      features: this.checkBrowserSupport(),
      store: store.getDebugInfo(),
      connection: store.get('connection'),
      streaming: gcodeStreamer.getStats()
    };
  }

  // Reiniciar aplicación
  async restart() {
    try {
      // Desconectar transporte actual
      if (window.currentTransport?.isConnected()) {
        await window.currentTransport.disconnect();
      }

      // Detener streaming
      if (gcodeStreamer.isStreaming) {
        gcodeStreamer.stop();
      }

      // Reset store
      store.reset();

      // Reinicializar
      await this.init();

      store.addConsoleMessage('Aplicación reiniciada', 'info');
    } catch (error) {
      console.error('Error reiniciando:', error);
      store.addConsoleMessage(`Error reiniciando: ${error.message}`, 'error');
    }
  }

  // Método para debugging
  debug() {
    console.log('=== Server3D Debug Info ===');
    console.log('App:', this.getInfo());
    console.log('Store:', store.getDebugInfo());
    console.log('Current Transport:', window.currentTransport);
    console.log('G-code Streamer:', gcodeStreamer.getStats());
    console.log('=========================');
  }
}

// Crear instancia de la aplicación
const app = new Server3DApp();

// Hacer disponible globalmente para debugging
window.server3d = app;

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });
} else {
  app.init();
}

// Export para uso como módulo
export default app;
