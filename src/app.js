// Aplicación principal Server3D
import { store } from './store.js';
import { uiManager } from './ui.js';
import { gcodeStreamer } from './gcodeStreamer.js';
import { pluginManager } from './plugins/pluginManager.js';

class Server3DApp {
  constructor() {
    this.version = '2.0.0';
    this.initialized = false;
    this.features = {
      plugins: true,
      advancedAnalytics: true,
      safetySystem: true,
      temperatureMonitoring: true,
      historyTracking: true,
      multiLanguage: true,
      cloudSync: false // Para futura implementación
    };
    
    // Estadísticas de la aplicación
    this.appStats = {
      startTime: Date.now(),
      commandsSent: 0,
      errorsHandled: 0,
      connectionsAttempted: 0
    };
  }

  // Inicializar aplicación
  async init() {
    try {
      console.log(`🖨️ Server3D v${this.version} iniciando...`);
      console.log('🚀 Nueva versión con características avanzadas:');
      console.log('   - Sistema de plugins extensible');
      console.log('   - Monitoreo inteligente de temperatura');
      console.log('   - Análisis avanzado de G-code');
      console.log('   - Sistema de seguridad mejorado');
      console.log('   - Registro de historial y estadísticas');
      
      // Verificar compatibilidad del navegador
      this.checkBrowserSupport();
      
      // Solicitar permisos de notificaciones
      await this.requestNotificationPermissions();
      
      // Inicializar sistema de plugins PRIMERO
      await this.initializePluginSystem();
      
      // Inicializar UI Manager
      uiManager.init();
      
      // Hacer disponibles globalmente algunos objetos
      window.store = store;
      window.gcodeStreamer = gcodeStreamer;
      window.pluginManager = pluginManager;
      window.currentTransport = null;
      
      // Configurar manejadores globales
      this.setupGlobalHandlers();
      
      // Configurar hooks del sistema
      this.setupSystemHooks();
      
      // Mensaje de bienvenida mejorado
      store.addConsoleMessage(`🚀 Server3D v${this.version} iniciado correctamente`, 'success');
      store.addConsoleMessage('✨ Sistema de plugins cargado', 'info');
      store.addConsoleMessage('🛡️ Protecciones de seguridad activas', 'info');
      store.addConsoleMessage('Selecciona un tipo de conexión para comenzar', 'info');
      
      // Log de soporte del navegador y características
      this.logBrowserSupport();
      this.logFeatureStatus();
      
      this.initialized = true;
      
      console.log('✅ Server3D iniciado correctamente');
      
      // Emitir evento de inicialización completa
      pluginManager.emit('app:initialized', { 
        version: this.version,
        features: this.features,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ Error iniciando Server3D:', error);
      store.addConsoleMessage(`Error iniciando aplicación: ${error.message}`, 'error');
      this.appStats.errorsHandled++;
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

  // Inicializar sistema de plugins
  async initializePluginSystem() {
    try {
      await pluginManager.init();
      console.log('🔌 Sistema de plugins inicializado');
      
      // Verificar plugins cargados
      const loadedPlugins = pluginManager.listPlugins();
      const activePlugins = loadedPlugins.filter(p => p.active);
      
      console.log(`🔌 Plugins activos: ${activePlugins.length}/${loadedPlugins.length}`);
      activePlugins.forEach(plugin => {
        console.log(`  - ${plugin.metadata.name} v${plugin.metadata.version}`);
      });
      
    } catch (error) {
      console.error('Error inicializando plugins:', error);
      store.addConsoleMessage(`Error en sistema de plugins: ${error.message}`, 'warning');
    }
  }

  // Solicitar permisos de notificaciones
  async requestNotificationPermissions() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('✅ Permisos de notificación concedidos');
        } else {
          console.log('⚠️ Permisos de notificación denegados');
        }
      } catch (error) {
        console.warn('Error solicitando permisos de notificación:', error);
      }
    }
  }

  // Configurar hooks del sistema
  setupSystemHooks() {
    // Hook para comandos enviados
    const originalSendCommand = async (command) => {
      this.appStats.commandsSent++;
      
      // Ejecutar hooks antes del comando
      const processedCommand = await pluginManager.executeHook('before:command', {
        ...command,
        timestamp: Date.now()
      }, { cancellable: true });
      
      if (processedCommand.__cancelled) {
        throw new Error(processedCommand.error || 'Comando cancelado por sistema de seguridad');
      }
      
      // Ejecutar hooks después del comando
      await pluginManager.executeHook('after:command', {
        ...processedCommand,
        success: true
      });
      
      return processedCommand;
    };
    
    // Hook para errores
    window.addEventListener('error', (event) => {
      this.appStats.errorsHandled++;
      
      pluginManager.executeHook('error:occurred', {
        message: event.error?.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        timestamp: Date.now(),
        severity: 'error'
      });
    });
  }

  // Log de estado de características
  logFeatureStatus() {
    console.log('🚀 Características de Server3D:');
    Object.entries(this.features).forEach(([feature, enabled]) => {
      const status = enabled ? '✅' : '❌';
      console.log(`  ${status} ${feature}: ${enabled ? 'Habilitado' : 'Deshabilitado'}`);
    });
    
    // Log de estadísticas de plugins
    const pluginStats = pluginManager.getDebugInfo();
    if (pluginStats.pluginCount > 0) {
      console.log(`🔌 Plugins: ${pluginStats.activePlugins}/${pluginStats.pluginCount} activos`);
    }
  }

  // Obtener estadísticas de la aplicación
  getAppStats() {
    const uptime = Date.now() - this.appStats.startTime;
    const pluginStats = pluginManager.getDebugInfo();
    
    return {
      ...this.appStats,
      uptime,
      uptimeFormatted: this.formatUptime(uptime),
      version: this.version,
      features: this.features,
      plugins: pluginStats,
      memoryUsage: this.getMemoryUsage()
    };
  }

  // Formatear tiempo de actividad
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Obtener uso de memoria (si está disponible)
  getMemoryUsage() {
    if ('memory' in performance) {
      const memory = performance.memory;
      return {
        used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
      };
    }
    return null;
  }

  // Manejar actualizaciones de temperatura
  async handleTemperatureUpdate(data) {
    await pluginManager.executeHook('temperature:update', {
      ...data,
      timestamp: Date.now()
    });
  }

  // Manejar cambios de posición
  async handlePositionUpdate(data) {
    await pluginManager.executeHook('position:update', {
      ...data,
      timestamp: Date.now()
    });
  }

  // Manejar cambios en el estado de impresión
  async handlePrintStatusChange(status, metadata = {}) {
    await pluginManager.executeHook('print:status:change', {
      status,
      metadata,
      timestamp: Date.now()
    });
  }

  // Manejar conexión
  async handleConnection(type, data = {}) {
    this.appStats.connectionsAttempted++;
    
    await pluginManager.executeHook('before:connect', {
      type,
      data,
      timestamp: Date.now()
    });
  }

  // Manejar desconexión
  async handleDisconnection(reason = 'user_initiated') {
    await pluginManager.executeHook('before:disconnect', {
      reason,
      timestamp: Date.now()
    });
  }

  // API para plugins externos
  registerExternalPlugin(name, pluginClass) {
    try {
      const plugin = new pluginClass();
      pluginManager.registerPlugin(name, plugin);
      console.log(`🔌 Plugin externo registrado: ${name}`);
      return true;
    } catch (error) {
      console.error(`Error registrando plugin ${name}:`, error);
      return false;
    }
  }

  // Obtener información extendida
  getExtendedInfo() {
    const basicInfo = this.getInfo();
    const appStats = this.getAppStats();
    
    // Obtener información de plugins activos
    const activePlugins = pluginManager.listPlugins()
      .filter(p => p.active)
      .map(p => ({
        name: p.name,
        version: p.metadata.version,
        description: p.metadata.description
      }));
    
    return {
      ...basicInfo,
      stats: appStats,
      plugins: activePlugins,
      security: pluginManager.getPlugin('safetyManager')?.getSecurityStatus() || null,
      temperature: pluginManager.getPlugin('temperatureMonitor')?.getCurrentStats() || null,
      history: pluginManager.getPlugin('historyLogger')?.getLifetimeStats() || null
    };
  }

  // Método para debugging mejorado
  debug() {
    console.log('=== Server3D v2.0 Debug Info ===');
    console.log('App:', this.getExtendedInfo());
    console.log('Store:', store.getDebugInfo());
    console.log('Current Transport:', window.currentTransport);
    console.log('G-code Streamer:', gcodeStreamer.getStats());
    console.log('Plugin Manager:', pluginManager.getDebugInfo());
    console.log('================================');
  }

  // Comando de ayuda mejorado
  help() {
    console.log('🆘 Server3D v2.0 - Comandos disponibles:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 Aplicación:');
    console.log('  server3d.debug()           - Información de debug');
    console.log('  server3d.restart()         - Reiniciar aplicación');
    console.log('  server3d.getExtendedInfo() - Información extendida');
    console.log('  server3d.getAppStats()     - Estadísticas de uso');
    console.log('');
    console.log('🔌 Plugins:');
    console.log('  pluginManager.listPlugins() - Listar plugins');
    console.log('  pluginManager.getDebugInfo() - Info de plugins');
    console.log('');
    console.log('🛡️ Seguridad:');
    console.log('  Ctrl+Shift+E - Parada de emergencia');
    console.log('  F1 - Limpiar estado de emergencia');
    console.log('  Escape - Parada de emergencia (con conexión)');
    console.log('');
    console.log('📊 Análisis:');
    console.log('  El análisis de G-code se ejecuta automáticamente');
    console.log('  Las estadísticas se guardan en localStorage');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
