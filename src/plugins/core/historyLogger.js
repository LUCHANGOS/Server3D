// Plugin de registro de historial y estadísticas de impresión

import { BasePlugin } from '../pluginManager.js';

export default class HistoryLoggerPlugin extends BasePlugin {
  constructor() {
    super('historyLogger', '1.0.0');
    
    this.history = [];
    this.currentSession = null;
    this.currentPrint = null;
    this.lifetimeStats = {
      printCount: 0,
      printTime: 0,
      filamentUsed: 0,
      successCount: 0,
      failureCount: 0,
      lastPrintDate: null,
      connectionCount: 0
    };
    
    // Almacenamiento local para estadísticas
    this.storageKey = 'server3d_history';
    this.loadFromStorage();
  }

  getMetadata() {
    return {
      name: 'Registrador de Historial',
      version: this.version,
      description: 'Registro de historial de impresiones y estadísticas de uso',
      author: 'Server3D Core Team',
      website: 'https://github.com/LUCHANGOS/Server3D',
      dependencies: []
    };
  }

  getDefaultSettings() {
    return {
      enabled: true,
      maxHistoryItems: 100,
      trackPrintTime: true,
      trackMaterialUsage: true,
      trackTemperatureStats: true,
      trackErrorStats: true,
      persistToLocalStorage: true,
      autoTagPrints: true,
      exportEnabled: true,
      cleanupOldEntries: true,
      maxStorageSize: 5 * 1024 * 1024 // 5MB
    };
  }

  async activate(pluginManager) {
    await super.activate(pluginManager);
    
    this.settings = {
      ...this.getDefaultSettings(),
      ...pluginManager.plugins.get(this.name)?.settings
    };

    // Registrar hooks
    this.addHook('after:connect', this.onConnectionStart.bind(this), 10);
    this.addHook('before:disconnect', this.onConnectionEnd.bind(this), 10);
    this.addHook('print:status:change', this.onPrintStatusChange.bind(this), 10);
    this.addHook('temperature:update', this.onTemperatureUpdate.bind(this), 20);
    this.addHook('error:occurred', this.onErrorOccurred.bind(this), 10);
    this.addHook('gcode:loaded', this.onGcodeLoaded.bind(this), 10);
    this.addHook('after:gcode:stream', this.onGcodeStreamComplete.bind(this), 10);

    console.log('📊 Registrador de historial activado');
    this.logStorageStatus();
  }

  async deactivate() {
    this.finishCurrentSession();
    await super.deactivate();
  }

  // Cargar historial del almacenamiento local
  loadFromStorage() {
    if (typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.history = data.history || [];
        this.lifetimeStats = data.stats || this.lifetimeStats;
        
        console.log(`📋 Historial cargado: ${this.history.length} entradas`);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  }

  // Guardar historial en almacenamiento local
  saveToStorage() {
    if (!this.settings.persistToLocalStorage || typeof localStorage === 'undefined') return;

    try {
      const data = {
        history: this.history,
        stats: this.lifetimeStats,
        version: this.version,
        timestamp: Date.now()
      };
      
      const serialized = JSON.stringify(data);
      if (serialized.length > this.settings.maxStorageSize) {
        this.cleanupOldEntries(this.settings.maxStorageSize);
        return this.saveToStorage();
      }
      
      localStorage.setItem(this.storageKey, serialized);
      console.log('💾 Historial guardado en almacenamiento local');
    } catch (error) {
      console.error('Error guardando historial:', error);
    }
  }

  // Limpiar entradas antiguas
  cleanupOldEntries(targetSize) {
    if (!this.settings.cleanupOldEntries) return;
    
    // Ordenar por fecha, más antiguos primero
    this.history.sort((a, b) => a.timestamp - b.timestamp);
    
    // Eliminar entradas antiguas hasta alcanzar el tamaño objetivo
    while (this.history.length > 10) { // Mantener al menos 10 entradas
      this.history.shift();
      
      // Comprobar tamaño actual
      const currentSize = JSON.stringify({
        history: this.history,
        stats: this.lifetimeStats
      }).length;
      
      if (currentSize < targetSize * 0.9) {
        break;
      }
    }
    
    console.log(`🧹 Limpieza de historial: ${this.history.length} entradas restantes`);
  }

  // Hook: Inicio de conexión
  async onConnectionStart(data) {
    if (!this.settings.enabled) return data;

    this.lifetimeStats.connectionCount++;
    
    this.currentSession = {
      id: `session_${Date.now()}`,
      type: data.type || 'unknown',
      deviceName: data.deviceName || 'unknown',
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      prints: [],
      temperatures: {
        hotend: [],
        bed: []
      },
      errors: [],
      commands: 0,
      status: 'active'
    };

    console.log(`📝 Nueva sesión iniciada: ${this.currentSession.id}`);
    this.emit('session:started', { session: this.currentSession });
    
    this.saveToStorage();
    
    return data;
  }

  // Hook: Fin de conexión
  async onConnectionEnd(data) {
    if (!this.settings.enabled || !this.currentSession) return data;

    this.finishCurrentSession();
    return data;
  }

  // Finalizar sesión actual
  finishCurrentSession() {
    if (!this.currentSession) return;
    
    // Finalizar impresión en curso si existe
    if (this.currentPrint && this.currentPrint.status === 'printing') {
      this.finishCurrentPrint('cancelled');
    }
    
    this.currentSession.endTime = Date.now();
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
    this.currentSession.status = 'completed';
    
    // Agregar a historial
    this.history.push(this.currentSession);
    
    // Mantener límite de historial
    if (this.history.length > this.settings.maxHistoryItems) {
      this.history = this.history.slice(-this.settings.maxHistoryItems);
    }
    
    console.log(`📝 Sesión finalizada: ${this.currentSession.id} (${Math.round(this.currentSession.duration / 1000)}s)`);
    this.emit('session:ended', { session: this.currentSession });
    
    this.currentSession = null;
    this.saveToStorage();
  }

  // Hook: Cambio de estado de impresión
  async onPrintStatusChange(data) {
    if (!this.settings.enabled || !this.currentSession) return data;

    const { status, filename } = data;
    
    switch (status) {
      case 'started':
        this.startNewPrint(filename, data);
        break;
        
      case 'paused':
        if (this.currentPrint) {
          this.currentPrint.status = 'paused';
          this.currentPrint.pauseCount = (this.currentPrint.pauseCount || 0) + 1;
          this.currentPrint.events.push({
            type: 'pause',
            timestamp: Date.now(),
            data: data.metadata || {}
          });
        }
        break;
        
      case 'resumed':
        if (this.currentPrint) {
          this.currentPrint.status = 'printing';
          this.currentPrint.events.push({
            type: 'resume',
            timestamp: Date.now(),
            data: data.metadata || {}
          });
        }
        break;
        
      case 'completed':
        this.finishCurrentPrint('completed', data);
        break;
        
      case 'failed':
        this.finishCurrentPrint('failed', data);
        break;
        
      case 'cancelled':
        this.finishCurrentPrint('cancelled', data);
        break;
    }
    
    this.saveToStorage();
    
    return data;
  }

  // Iniciar nueva impresión
  startNewPrint(filename, data = {}) {
    if (this.currentPrint) {
      this.finishCurrentPrint('cancelled');
    }
    
    this.currentPrint = {
      id: `print_${Date.now()}`,
      filename: filename || 'unknown',
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      status: 'printing',
      analysis: data.analysis || null,
      metadata: data.metadata || {},
      estimatedTime: data.estimatedTime || 0,
      layerCount: data.layerCount || 0,
      material: {
        type: data.materialType || 'unknown',
        usage: data.materialUsage || 0
      },
      temperatures: {
        hotend: [],
        bed: []
      },
      layers: [],
      pauseCount: 0,
      events: [
        {
          type: 'start',
          timestamp: Date.now(),
          data: {}
        }
      ],
      tags: this.generateTags(filename, data)
    };
    
    // Añadir a la sesión actual
    if (this.currentSession) {
      this.currentSession.prints.push(this.currentPrint);
    }
    
    console.log(`🖨️ Impresión iniciada: ${this.currentPrint.filename}`);
    this.emit('print:started', { print: this.currentPrint });
  }

  // Finalizar impresión actual
  finishCurrentPrint(status = 'completed', data = {}) {
    if (!this.currentPrint) return;
    
    this.currentPrint.endTime = Date.now();
    this.currentPrint.duration = this.currentPrint.endTime - this.currentPrint.startTime;
    this.currentPrint.status = status;
    
    if (data.metadata) {
      this.currentPrint.metadata = { ...this.currentPrint.metadata, ...data.metadata };
    }
    
    this.currentPrint.events.push({
      type: status,
      timestamp: Date.now(),
      data: data || {}
    });
    
    // Actualizar estadísticas globales
    this.lifetimeStats.printCount++;
    this.lifetimeStats.printTime += this.currentPrint.duration;
    this.lifetimeStats.lastPrintDate = Date.now();
    
    if (this.currentPrint.material && this.currentPrint.material.usage) {
      this.lifetimeStats.filamentUsed += this.currentPrint.material.usage;
    }
    
    if (status === 'completed') {
      this.lifetimeStats.successCount++;
    } else if (status === 'failed') {
      this.lifetimeStats.failureCount++;
    }
    
    console.log(`🖨️ Impresión finalizada: ${this.currentPrint.filename} (${status})`);
    this.emit('print:ended', { 
      print: this.currentPrint,
      status,
      duration: this.currentPrint.duration
    });
    
    this.currentPrint = null;
    this.saveToStorage();
  }

  // Hook: Actualización de temperatura
  async onTemperatureUpdate(data) {
    if (!this.settings.enabled || !this.settings.trackTemperatureStats) return data;
    
    if (this.currentSession && this.settings.trackTemperatureStats) {
      const timestamp = Date.now();
      
      // Limitar cantidad de lecturas guardadas (1 por minuto máx)
      const lastHotendReading = this.currentSession.temperatures.hotend.length > 0 ? 
        this.currentSession.temperatures.hotend[this.currentSession.temperatures.hotend.length - 1] : null;
      
      if (!lastHotendReading || (timestamp - lastHotendReading.timestamp) > 60000) {
        if (data.hotend) {
          this.currentSession.temperatures.hotend.push({
            timestamp,
            current: data.hotend.current,
            target: data.hotend.target
          });
        }
        
        if (data.bed) {
          this.currentSession.temperatures.bed.push({
            timestamp,
            current: data.bed.current,
            target: data.bed.target
          });
        }
      }
      
      // Si hay una impresión activa, registrar también ahí
      if (this.currentPrint && this.currentPrint.status === 'printing') {
        // Guardar solo lecturas significativas para la impresión
        const significantChange = this.isSignificantTemperatureChange(data, this.currentPrint);
        
        if (significantChange) {
          if (data.hotend) {
            this.currentPrint.temperatures.hotend.push({
              timestamp,
              current: data.hotend.current,
              target: data.hotend.target
            });
          }
          
          if (data.bed) {
            this.currentPrint.temperatures.bed.push({
              timestamp,
              current: data.bed.current,
              target: data.bed.target
            });
          }
        }
      }
    }
    
    return data;
  }

  // Hook: Error ocurrido
  async onErrorOccurred(data) {
    if (!this.settings.enabled || !this.settings.trackErrorStats) return data;
    
    if (this.currentSession) {
      this.currentSession.errors.push({
        timestamp: Date.now(),
        message: data.message || 'Unknown error',
        code: data.code || 'unknown',
        severity: data.severity || 'error'
      });
      
      // Si hay una impresión activa y es un error grave
      if (this.currentPrint && this.currentPrint.status === 'printing' && 
          data.severity === 'critical') {
        
        this.currentPrint.events.push({
          type: 'error',
          timestamp: Date.now(),
          data: {
            message: data.message,
            code: data.code
          }
        });
        
        // Considerar si debemos marcar la impresión como fallida
        if (data.affects === 'print') {
          this.finishCurrentPrint('failed', { error: data });
        }
      }
      
      this.saveToStorage();
    }
    
    return data;
  }

  // Hook: G-code cargado
  async onGcodeLoaded(data) {
    if (!this.settings.enabled) return data;
    
    // Guardar información del archivo para futuras impresiones
    if (data.filename && data.analysis) {
      const fileInfo = {
        filename: data.filename,
        timestamp: Date.now(),
        analysis: data.analysis,
        metadata: data.metadata || {}
      };
      
      this.emit('file:loaded', { file: fileInfo });
    }
    
    return data;
  }

  // Hook: Streaming de G-code completado
  async onGcodeStreamComplete(data) {
    if (!this.settings.enabled) return data;
    
    // Si hay estadísticas de uso de material, actualizar
    if (data.stats && this.currentPrint) {
      if (data.stats.filamentUsed) {
        this.currentPrint.material.usage = data.stats.filamentUsed;
      }
      
      if (data.stats.totalLines) {
        this.currentPrint.metadata.totalLines = data.stats.totalLines;
      }
      
      if (data.stats.printTime) {
        this.currentPrint.duration = data.stats.printTime;
      }
    }
    
    return data;
  }

  // Generar etiquetas automáticas
  generateTags(filename, data = {}) {
    if (!this.settings.autoTagPrints) return [];
    
    const tags = [];
    
    // Tag por nombre de archivo
    if (filename) {
      if (filename.includes('test')) tags.push('test');
      if (filename.includes('benchy')) tags.push('benchy');
      if (filename.includes('calibration')) tags.push('calibration');
    }
    
    // Tags por análisis
    if (data.analysis) {
      if (data.analysis.printTime && data.analysis.printTime > 3600 * 10) {
        tags.push('long_print');
      }
      
      if (data.analysis.layerHeight && data.analysis.layerHeight <= 0.1) {
        tags.push('high_quality');
      }
    }
    
    return tags;
  }

  // Determinar si una actualización de temperatura es significativa
  isSignificantTemperatureChange(data, print) {
    // Guardar la primera lectura siempre
    if (print.temperatures.hotend.length === 0) return true;
    
    const lastHotend = print.temperatures.hotend[print.temperatures.hotend.length - 1];
    const lastBed = print.temperatures.bed[print.temperatures.bed.length - 1];
    
    // Cambio significativo en hotend
    if (data.hotend && lastHotend) {
      const tempDiff = Math.abs(data.hotend.current - lastHotend.current);
      const targetChange = data.hotend.target !== lastHotend.target;
      
      if (tempDiff > 2 || targetChange) return true;
    }
    
    // Cambio significativo en cama
    if (data.bed && lastBed) {
      const tempDiff = Math.abs(data.bed.current - lastBed.current);
      const targetChange = data.bed.target !== lastBed.target;
      
      if (tempDiff > 1 || targetChange) return true;
    }
    
    // Guardar una lectura cada 5 minutos de todas formas
    const timeSinceLastReading = Date.now() - lastHotend.timestamp;
    if (timeSinceLastReading > 5 * 60 * 1000) return true;
    
    return false;
  }

  // Mostrar estado de almacenamiento
  logStorageStatus() {
    if (typeof localStorage === 'undefined') {
      console.log('📊 Almacenamiento local no disponible');
      return;
    }
    
    const storageSize = localStorage.getItem(this.storageKey)?.length || 0;
    console.log(`📊 Historial: ${this.history.length} entradas, ${(storageSize / 1024).toFixed(1)}KB`);
    console.log(`🖨️ Impresiones totales: ${this.lifetimeStats.printCount}`);
  }

  // API pública
  getSessionHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  getCurrentSessionInfo() {
    if (!this.currentSession) return null;
    
    return {
      ...this.currentSession,
      currentPrint: this.currentPrint
    };
  }

  getLifetimeStats() {
    return {
      ...this.lifetimeStats,
      successRate: this.lifetimeStats.printCount > 0 
        ? Math.round((this.lifetimeStats.successCount / this.lifetimeStats.printCount) * 100) 
        : 0,
      printTimeHours: Math.round(this.lifetimeStats.printTime / 3600000),
      filamentMeters: (this.lifetimeStats.filamentUsed / 1000).toFixed(1)
    };
  }

  searchHistory(query = {}) {
    let results = [...this.history];
    
    if (query.status) {
      results = results.filter(session => 
        session.prints.some(print => print.status === query.status)
      );
    }
    
    if (query.filename) {
      const searchTerm = query.filename.toLowerCase();
      results = results.filter(session => 
        session.prints.some(print => 
          print.filename.toLowerCase().includes(searchTerm)
        )
      );
    }
    
    if (query.timeRange) {
      results = results.filter(session => 
        session.startTime >= query.timeRange.start && 
        session.startTime <= query.timeRange.end
      );
    }
    
    if (query.tags && query.tags.length) {
      results = results.filter(session => 
        session.prints.some(print => 
          print.tags && print.tags.some(tag => query.tags.includes(tag))
        )
      );
    }
    
    return results;
  }

  exportData() {
    const exportData = {
      history: this.history,
      stats: this.lifetimeStats,
      version: this.version,
      currentSession: this.currentSession,
      currentPrint: this.currentPrint,
      exportedAt: Date.now()
    };
    
    return exportData;
  }

  clearHistory() {
    const oldCount = this.history.length;
    this.history = [];
    
    console.log(`🗑️ Historial eliminado (${oldCount} entradas)`);
    this.saveToStorage();
    
    return oldCount;
  }

  addTag(printId, tag) {
    let tagAdded = false;
    
    // Buscar en historial
    for (const session of this.history) {
      for (const print of session.prints) {
        if (print.id === printId) {
          if (!print.tags) print.tags = [];
          if (!print.tags.includes(tag)) {
            print.tags.push(tag);
            tagAdded = true;
          }
        }
      }
    }
    
    // Buscar en impresión actual
    if (this.currentPrint && this.currentPrint.id === printId) {
      if (!this.currentPrint.tags) this.currentPrint.tags = [];
      if (!this.currentPrint.tags.includes(tag)) {
        this.currentPrint.tags.push(tag);
        tagAdded = true;
      }
    }
    
    if (tagAdded) {
      this.saveToStorage();
    }
    
    return tagAdded;
  }

  removeTag(printId, tag) {
    let tagRemoved = false;
    
    // Buscar en historial
    for (const session of this.history) {
      for (const print of session.prints) {
        if (print.id === printId && print.tags) {
          const index = print.tags.indexOf(tag);
          if (index !== -1) {
            print.tags.splice(index, 1);
            tagRemoved = true;
          }
        }
      }
    }
    
    // Buscar en impresión actual
    if (this.currentPrint && this.currentPrint.id === printId && this.currentPrint.tags) {
      const index = this.currentPrint.tags.indexOf(tag);
      if (index !== -1) {
        this.currentPrint.tags.splice(index, 1);
        tagRemoved = true;
      }
    }
    
    if (tagRemoved) {
      this.saveToStorage();
    }
    
    return tagRemoved;
  }

  addNote(printId, note) {
    let noteAdded = false;
    
    // Buscar en historial
    for (const session of this.history) {
      for (const print of session.prints) {
        if (print.id === printId) {
          if (!print.notes) print.notes = [];
          print.notes.push({
            text: note,
            timestamp: Date.now()
          });
          noteAdded = true;
        }
      }
    }
    
    // Buscar en impresión actual
    if (this.currentPrint && this.currentPrint.id === printId) {
      if (!this.currentPrint.notes) this.currentPrint.notes = [];
      this.currentPrint.notes.push({
        text: note,
        timestamp: Date.now()
      });
      noteAdded = true;
    }
    
    if (noteAdded) {
      this.saveToStorage();
    }
    
    return noteAdded;
  }

  // Onboarding y configuración
  onSettingsChange(settings) {
    const oldValue = this.settings.persistToLocalStorage;
    this.settings = settings;
    
    if (settings.persistToLocalStorage && !oldValue) {
      // Si se activó el almacenamiento, guardar
      this.saveToStorage();
    }
    
    if (settings.maxHistoryItems < this.history.length) {
      // Reducir historial si cambió el límite
      this.history = this.history.slice(-settings.maxHistoryItems);
      this.saveToStorage();
    }
  }
}
