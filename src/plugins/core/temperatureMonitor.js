// Plugin de monitoreo avanzado de temperatura

import { BasePlugin } from '../pluginManager.js';

export default class TemperatureMonitorPlugin extends BasePlugin {
  constructor() {
    super('temperatureMonitor', '1.0.0');
    
    this.temperatureHistory = [];
    this.alerts = new Set();
    this.thresholds = {
      hotend: { min: 180, max: 280, critical: 300 },
      bed: { min: 40, max: 100, critical: 120 },
      ambient: { min: 15, max: 45, critical: 60 }
    };
    this.monitoringInterval = null;
    this.settings = {};
  }

  getMetadata() {
    return {
      name: 'Monitor de Temperatura',
      version: this.version,
      description: 'Monitoreo avanzado de temperatura con alertas predictivas',
      author: 'Server3D Core Team',
      website: 'https://github.com/LUCHANGOS/Server3D',
      dependencies: []
    };
  }

  getDefaultSettings() {
    return {
      enabled: true,
      alertEnabled: true,
      historyLength: 1000,
      monitoringInterval: 5000, // 5 segundos
      thermalRunawayDetection: true,
      pidTuningAssistant: true,
      customThresholds: false,
      notifications: {
        desktop: true,
        sound: false,
        vibration: false
      }
    };
  }

  async activate(pluginManager) {
    await super.activate(pluginManager);
    
    this.settings = {
      ...this.getDefaultSettings(),
      ...pluginManager.plugins.get(this.name)?.settings
    };

    if (this.settings.enabled) {
      this.startMonitoring();
    }

    // Registrar hooks
    this.addHook('temperature:update', this.onTemperatureUpdate.bind(this), 5);
    this.addHook('before:command', this.validateTemperatureCommand.bind(this), 5);
    this.addHook('after:connect', this.onConnectionEstablished.bind(this), 5);
    this.addHook('before:disconnect', this.onBeforeDisconnect.bind(this), 5);

    console.log('🌡️ Monitor de temperatura activado');
  }

  async deactivate() {
    this.stopMonitoring();
    await super.deactivate();
  }

  startMonitoring() {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      this.performChecks();
    }, this.settings.monitoringInterval);

    console.log('🔍 Monitoreo de temperatura iniciado');
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️ Monitoreo de temperatura detenido');
    }
  }

  // Hook: Actualización de temperatura
  async onTemperatureUpdate(data) {
    const timestamp = Date.now();
    
    // Agregar al historial
    this.addToHistory({
      timestamp,
      hotend: data.hotend || { current: 0, target: 0 },
      bed: data.bed || { current: 0, target: 0 },
      ambient: data.ambient || { current: 0 }
    });

    // Análisis en tiempo real
    this.analyzeTemperature(data, timestamp);

    return data;
  }

  // Hook: Validar comandos de temperatura
  async validateTemperatureCommand(command) {
    if (command.type !== 'temperature') return command;

    const { subtype, value } = command;
    const thresholds = this.thresholds[subtype];

    if (!thresholds) return command;

    if (value > thresholds.critical) {
      return {
        ...command,
        __cancelled: true,
        error: `🚨 Temperatura crítica detectada: ${value}°C > ${thresholds.critical}°C`
      };
    }

    if (value > thresholds.max) {
      this.createAlert('high_temp', `Temperatura alta: ${subtype} = ${value}°C`, 'warning');
    }

    return command;
  }

  // Hook: Conexión establecida
  async onConnectionEstablished() {
    this.clearAlerts();
    console.log('🌡️ Monitor listo para nueva conexión');
  }

  // Hook: Antes de desconectar
  async onBeforeDisconnect() {
    this.stopMonitoring();
    this.clearAlerts();
  }

  // Agregar lectura al historial
  addToHistory(reading) {
    this.temperatureHistory.push(reading);
    
    // Mantener límite del historial
    if (this.temperatureHistory.length > this.settings.historyLength) {
      this.temperatureHistory.shift();
    }

    // Emitir evento para otros plugins
    this.emit('history:updated', { reading, historyLength: this.temperatureHistory.length });
  }

  // Análisis de temperatura
  analyzeTemperature(data, timestamp) {
    if (this.temperatureHistory.length < 3) return;

    const recent = this.temperatureHistory.slice(-10);
    
    // Detectar thermal runaway
    if (this.settings.thermalRunawayDetection) {
      this.detectThermalRunaway(recent, data);
    }

    // Detectar fluctuaciones anómalas
    this.detectTemperatureFluctuations(recent);

    // Evaluar eficiencia de calentamiento
    this.evaluateHeatingEfficiency(recent, data);

    // Predicción de problemas
    this.predictPotentialIssues(recent, data);
  }

  // Detectar thermal runaway
  detectThermalRunaway(history, current) {
    const hotendReadings = history.map(h => h.hotend.current);
    const bedReadings = history.map(h => h.bed.current);

    // Para hotend
    if (current.hotend.target > 0) {
      const avgIncrease = this.calculateTemperatureRate(hotendReadings);
      if (avgIncrease > 5) { // Incremento muy rápido
        this.createAlert('thermal_runaway', '🚨 Posible thermal runaway en hotend detectado', 'critical');
      }
    }

    // Para cama
    if (current.bed.target > 0) {
      const avgIncrease = this.calculateTemperatureRate(bedReadings);
      if (avgIncrease > 3) {
        this.createAlert('thermal_runaway', '🚨 Posible thermal runaway en cama detectado', 'critical');
      }
    }
  }

  // Detectar fluctuaciones
  detectTemperatureFluctuations(history) {
    if (history.length < 5) return;

    const hotendTemps = history.map(h => h.hotend.current);
    const deviation = this.calculateStandardDeviation(hotendTemps);

    if (deviation > 5) {
      this.createAlert('fluctuation', `Fluctuaciones de temperatura detectadas: ±${deviation.toFixed(1)}°C`, 'warning');
    }
  }

  // Evaluar eficiencia de calentamiento
  evaluateHeatingEfficiency(history, current) {
    if (history.length < 10) return;

    const hotend = current.hotend;
    if (hotend.target === 0 || hotend.current >= hotend.target - 5) return;

    const recentReadings = history.slice(-10).map(h => h.hotend.current);
    const heatingRate = this.calculateTemperatureRate(recentReadings);

    if (heatingRate < 0.1) {
      this.createAlert('heating_slow', 'Calentamiento muy lento detectado - revisar termistor o cartucho', 'warning');
    }
  }

  // Predicción de problemas
  predictPotentialIssues(history, current) {
    // Implementar algoritmos de ML básicos aquí
    const trends = this.analyzeTrends(history);
    
    if (trends.hotendDrift > 3) {
      this.createAlert('drift', 'Deriva de temperatura detectada - posible problema de PID', 'info');
    }
  }

  // Cálculos auxiliares
  calculateTemperatureRate(temperatures) {
    if (temperatures.length < 2) return 0;
    
    const deltas = [];
    for (let i = 1; i < temperatures.length; i++) {
      deltas.push(temperatures[i] - temperatures[i - 1]);
    }
    
    return deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
  }

  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / values.length;
    return Math.sqrt(variance);
  }

  analyzeTrends(history) {
    // Análisis básico de tendencias
    const hotendTemps = history.map(h => h.hotend.current);
    const recent = hotendTemps.slice(-5);
    const older = hotendTemps.slice(-10, -5);
    
    const recentAvg = recent.reduce((sum, temp) => sum + temp, 0) / recent.length;
    const olderAvg = older.reduce((sum, temp) => sum + temp, 0) / older.length;
    
    return {
      hotendDrift: Math.abs(recentAvg - olderAvg)
    };
  }

  // Gestión de alertas
  createAlert(type, message, severity = 'info') {
    const alert = {
      id: `${type}_${Date.now()}`,
      type,
      message,
      severity,
      timestamp: Date.now(),
      acknowledged: false
    };

    this.alerts.add(alert);
    
    // Notificar al sistema
    this.pluginManager.emit('alert:created', alert);
    
    // Notificaciones del navegador
    if (this.settings.notifications.desktop && severity === 'critical') {
      this.showDesktopNotification(message);
    }

    console.warn(`🚨 [${severity.toUpperCase()}] ${message}`);
    
    return alert.id;
  }

  acknowledgeAlert(alertId) {
    for (const alert of this.alerts) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        this.emit('alert:acknowledged', alert);
        break;
      }
    }
  }

  clearAlerts() {
    this.alerts.clear();
    this.emit('alerts:cleared');
  }

  getActiveAlerts() {
    return Array.from(this.alerts).filter(alert => !alert.acknowledged);
  }

  // Notificación de escritorio
  showDesktopNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Server3D - Alerta de Temperatura', {
        body: message,
        icon: '/assets/icons/icon-192.png',
        tag: 'temperature-alert'
      });
    }
  }

  // Realizar verificaciones periódicas
  performChecks() {
    if (!window.currentTransport?.isConnected()) return;

    // Solicitar actualización de temperatura
    window.currentTransport.sendCommand('M105').catch(console.error);

    // Limpiar alertas antiguas
    this.cleanupOldAlerts();
  }

  cleanupOldAlerts() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutos

    for (const alert of this.alerts) {
      if (now - alert.timestamp > maxAge) {
        this.alerts.delete(alert);
      }
    }
  }

  // Configuración
  onSettingsChange(settings) {
    this.settings = settings;
    
    if (settings.enabled && !this.monitoringInterval) {
      this.startMonitoring();
    } else if (!settings.enabled && this.monitoringInterval) {
      this.stopMonitoring();
    }

    if (this.monitoringInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  // API pública
  getTemperatureHistory(limit = 100) {
    return this.temperatureHistory.slice(-limit);
  }

  getCurrentStats() {
    if (this.temperatureHistory.length === 0) return null;

    const latest = this.temperatureHistory[this.temperatureHistory.length - 1];
    const alerts = this.getActiveAlerts();

    return {
      current: latest,
      alertCount: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      historyLength: this.temperatureHistory.length,
      monitoring: !!this.monitoringInterval
    };
  }

  // Exportar datos para análisis
  exportData() {
    return {
      history: this.temperatureHistory,
      alerts: Array.from(this.alerts),
      settings: this.settings,
      metadata: this.getMetadata()
    };
  }
}
