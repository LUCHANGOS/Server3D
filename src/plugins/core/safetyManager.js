// Plugin de gestión de seguridad avanzado

import { BasePlugin } from '../pluginManager.js';

export default class SafetyManagerPlugin extends BasePlugin {
  constructor() {
    super('safetyManager', '1.0.0');
    
    this.safetyProfiles = new Map();
    this.activeRestrictions = new Set();
    this.emergencyTriggered = false;
    this.watchdogTimer = null;
    this.lastHeartbeat = 0;
    
    this.initializeDefaultProfiles();
  }

  getMetadata() {
    return {
      name: 'Gestor de Seguridad',
      version: this.version,
      description: 'Sistema de seguridad avanzado con protecciones inteligentes y perfiles configurables',
      author: 'Server3D Core Team',
      website: 'https://github.com/LUCHANGOS/Server3D',
      dependencies: []
    };
  }

  getDefaultSettings() {
    return {
      enabled: true,
      activeProfile: 'standard',
      emergencyStopEnabled: true,
      watchdogTimeout: 30000, // 30 segundos
      thermalProtection: true,
      movementLimits: true,
      commandFiltering: true,
      connectionMonitoring: true,
      autoShutdown: {
        enabled: false,
        maxIdleTime: 600000, // 10 minutos
        cooldownFirst: true
      },
      notifications: {
        browser: true,
        console: true,
        sound: false
      },
      restrictions: {
        maxHotendTemp: 280,
        maxBedTemp: 120,
        maxFeedrate: 6000,
        maxAcceleration: 3000,
        buildVolumeX: 220,
        buildVolumeY: 220,
        buildVolumeZ: 250
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
      this.initializeSafety();
    }

    // Registrar hooks críticos con alta prioridad
    this.addHook('before:command', this.validateCommand.bind(this), 1);
    this.addHook('before:connect', this.onBeforeConnect.bind(this), 1);
    this.addHook('after:connect', this.onAfterConnect.bind(this), 1);
    this.addHook('before:disconnect', this.onBeforeDisconnect.bind(this), 1);
    this.addHook('temperature:update', this.monitorTemperatures.bind(this), 1);
    this.addHook('position:update', this.monitorPosition.bind(this), 1);
    this.addHook('before:gcode:stream', this.validateGcodeStream.bind(this), 1);
    this.addHook('error:occurred', this.handleError.bind(this), 1);

    console.log('🛡️ Gestor de seguridad activado');
    this.logSafetyStatus();
  }

  async deactivate() {
    this.stopWatchdog();
    this.clearEmergencyState();
    await super.deactivate();
  }

  // Inicializar perfiles de seguridad por defecto
  initializeDefaultProfiles() {
    // Perfil estándar
    this.safetyProfiles.set('standard', {
      name: 'Estándar',
      description: 'Configuración balanceada para uso general',
      restrictions: {
        maxHotendTemp: 280,
        maxBedTemp: 120,
        maxFeedrate: 6000,
        maxAcceleration: 3000,
        buildVolume: { x: 220, y: 220, z: 250 }
      },
      protections: {
        thermalRunaway: true,
        movementLimits: true,
        emergencyStop: true,
        commandFiltering: true
      },
      allowedCommands: ['G0', 'G1', 'G28', 'G90', 'G91', 'M104', 'M105', 'M109', 'M140', 'M190', 'M106', 'M107']
    });

    // Perfil conservador
    this.safetyProfiles.set('conservative', {
      name: 'Conservador',
      description: 'Máxima seguridad para principiantes',
      restrictions: {
        maxHotendTemp: 250,
        maxBedTemp: 80,
        maxFeedrate: 3000,
        maxAcceleration: 1500,
        buildVolume: { x: 200, y: 200, z: 200 }
      },
      protections: {
        thermalRunaway: true,
        movementLimits: true,
        emergencyStop: true,
        commandFiltering: true,
        speedLimiting: true
      },
      allowedCommands: ['G0', 'G1', 'G28', 'G90', 'M104', 'M105', 'M140', 'M106', 'M107']
    });

    // Perfil avanzado
    this.safetyProfiles.set('advanced', {
      name: 'Avanzado',
      description: 'Menos restricciones para usuarios experimentados',
      restrictions: {
        maxHotendTemp: 300,
        maxBedTemp: 150,
        maxFeedrate: 12000,
        maxAcceleration: 5000,
        buildVolume: { x: 300, y: 300, z: 400 }
      },
      protections: {
        thermalRunaway: true,
        movementLimits: false,
        emergencyStop: true,
        commandFiltering: false
      },
      allowedCommands: [] // Sin restricciones
    });
  }

  // Inicializar sistema de seguridad
  initializeSafety() {
    this.loadProfile(this.settings.activeProfile);
    
    if (this.settings.watchdogTimeout > 0) {
      this.startWatchdog();
    }
    
    // Configurar teclas de emergencia
    this.setupEmergencyKeys();
    
    console.log('🔒 Sistema de seguridad inicializado');
  }

  // Hook: Validar comando antes de ejecución
  async validateCommand(command) {
    if (!this.settings.enabled) return command;

    const profile = this.getCurrentProfile();
    if (!profile) return command;

    try {
      // Verificar estado de emergencia
      if (this.emergencyTriggered) {
        return {
          ...command,
          __cancelled: true,
          error: '🚨 Sistema en estado de emergencia - comando bloqueado'
        };
      }

      // Filtrado de comandos
      if (profile.protections.commandFiltering && profile.allowedCommands.length > 0) {
        const isAllowed = this.isCommandAllowed(command, profile.allowedCommands);
        if (!isAllowed) {
          return {
            ...command,
            __cancelled: true,
            error: `🚫 Comando no permitido en perfil '${profile.name}': ${command.gcode || command.type}`
          };
        }
      }

      // Validaciones específicas por tipo de comando
      const validationResult = await this.validateSpecificCommand(command, profile);
      if (validationResult.error) {
        return {
          ...command,
          __cancelled: true,
          error: validationResult.error
        };
      }

      // Actualizar heartbeat
      this.updateHeartbeat();

      return command;

    } catch (error) {
      console.error('Error validando comando:', error);
      return {
        ...command,
        __cancelled: true,
        error: `Error de seguridad: ${error.message}`
      };
    }
  }

  // Validar comandos específicos
  async validateSpecificCommand(command, profile) {
    switch (command.type) {
      case 'temperature':
        return this.validateTemperatureCommand(command, profile);
      
      case 'movement':
        return this.validateMovementCommand(command, profile);
        
      case 'gcode':
        return this.validateGcodeCommand(command, profile);
        
      default:
        return { valid: true };
    }
  }

  // Validar comando de temperatura
  validateTemperatureCommand(command, profile) {
    const { subtype, value } = command;
    const restrictions = profile.restrictions;

    if (subtype === 'hotend' && value > restrictions.maxHotendTemp) {
      return {
        valid: false,
        error: `🌡️ Temperatura hotend excede límite: ${value}°C > ${restrictions.maxHotendTemp}°C`
      };
    }

    if (subtype === 'bed' && value > restrictions.maxBedTemp) {
      return {
        valid: false,
        error: `🌡️ Temperatura cama excede límite: ${value}°C > ${restrictions.maxBedTemp}°C`
      };
    }

    return { valid: true };
  }

  // Validar comando de movimiento
  validateMovementCommand(command, profile) {
    if (!profile.protections.movementLimits) return { valid: true };

    const { subtype, distance, axis } = command;
    const restrictions = profile.restrictions;

    if (subtype === 'move' && Math.abs(distance) > restrictions.buildVolume[axis.toLowerCase()]) {
      return {
        valid: false,
        error: `📐 Movimiento excede límites de construcción: ${axis}${distance}mm`
      };
    }

    return { valid: true };
  }

  // Validar comando G-code
  validateGcodeCommand(command, profile) {
    const gcode = command.gcode || command.command;
    
    // Detectar comandos peligrosos
    const dangerousPatterns = [
      /M999/, // Reset después de error
      /M302/, // Extrusión en frío
      /M150/, // LED control (puede ser peligroso en algunas impresoras)
      /G92\s+E/, // Reset extrusor (puede causar problemas)
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(gcode)) {
        return {
          valid: false,
          error: `⚠️ Comando potencialmente peligroso detectado: ${gcode}`
        };
      }
    }

    // Verificar parámetros de velocidad y aceleración
    const feedrateMatch = gcode.match(/F(\d+)/);
    if (feedrateMatch) {
      const feedrate = parseInt(feedrateMatch[1]);
      if (feedrate > profile.restrictions.maxFeedrate) {
        return {
          valid: false,
          error: `🏃 Velocidad excede límite: ${feedrate} > ${profile.restrictions.maxFeedrate}mm/min`
        };
      }
    }

    return { valid: true };
  }

  // Hook: Monitoreo de temperaturas
  async monitorTemperatures(data) {
    if (!this.settings.thermalProtection) return data;

    const profile = this.getCurrentProfile();
    if (!profile) return data;

    // Verificar temperaturas críticas
    if (data.hotend?.current > profile.restrictions.maxHotendTemp + 10) {
      await this.triggerEmergencyStop('🔥 Temperatura crítica hotend detectada');
    }

    if (data.bed?.current > profile.restrictions.maxBedTemp + 10) {
      await this.triggerEmergencyStop('🔥 Temperatura crítica cama detectada');
    }

    // Detectar thermal runaway básico
    if (profile.protections.thermalRunaway) {
      this.detectThermalRunaway(data);
    }

    return data;
  }

  // Hook: Monitoreo de posición
  async monitorPosition(data) {
    if (!this.settings.movementLimits) return data;

    const profile = this.getCurrentProfile();
    if (!profile?.protections.movementLimits) return data;

    const { x, y, z } = data;
    const limits = profile.restrictions.buildVolume;

    // Verificar límites de construcción
    if (x > limits.x || y > limits.y || z > limits.z || x < 0 || y < 0 || z < 0) {
      await this.triggerEmergencyStop(`📍 Posición fuera de límites: X${x} Y${y} Z${z}`);
    }

    return data;
  }

  // Hook: Validar streaming de G-code
  async validateGcodeStream(data) {
    if (!this.settings.enabled || !data.gcode) return data;

    const profile = this.getCurrentProfile();
    if (!profile) return data;

    // Análisis rápido de seguridad del archivo
    const lines = data.gcode.split('\n').slice(0, 100); // Primeras 100 líneas
    const issues = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';')) continue;

      // Buscar temperaturas peligrosas
      const tempMatch = trimmed.match(/[MS](\d{3})/);
      if (tempMatch) {
        const temp = parseInt(tempMatch[1]);
        if (temp > 300) {
          issues.push(`Temperatura peligrosa encontrada: ${temp}°C en línea "${trimmed}"`);
        }
      }

      // Buscar velocidades excesivas
      const feedrateMatch = trimmed.match(/F(\d+)/);
      if (feedrateMatch) {
        const feedrate = parseInt(feedrateMatch[1]);
        if (feedrate > profile.restrictions.maxFeedrate) {
          issues.push(`Velocidad excesiva: ${feedrate}mm/min en línea "${trimmed}"`);
        }
      }
    }

    if (issues.length > 0) {
      const proceed = await this.showSafetyWarning(
        '⚠️ Problemas de seguridad detectados en G-code',
        issues.join('\n'),
        'continue'
      );

      if (!proceed) {
        return {
          ...data,
          __cancelled: true,
          error: 'Streaming cancelado por problemas de seguridad'
        };
      }
    }

    return data;
  }

  // Detectar thermal runaway básico
  detectThermalRunaway(data) {
    // Implementar lógica simple de detección
    // En un sistema real, esto sería más sofisticado
    const hotend = data.hotend;
    if (hotend?.target > 0 && hotend.current > hotend.target + 15) {
      this.triggerEmergencyStop('🔥 Thermal runaway detectado en hotend');
    }
  }

  // Activar parada de emergencia
  async triggerEmergencyStop(reason = 'Parada de emergencia manual') {
    if (this.emergencyTriggered) return;

    this.emergencyTriggered = true;
    console.error(`🚨 PARADA DE EMERGENCIA: ${reason}`);

    try {
      // Enviar comandos de emergencia
      if (window.currentTransport?.isConnected()) {
        await window.currentTransport.sendCommand('M112'); // Emergency stop
        await window.currentTransport.sendCommand('M104 S0'); // Hotend off
        await window.currentTransport.sendCommand('M140 S0'); // Bed off
        await window.currentTransport.sendCommand('M107'); // Fan off
      }

      // Detener streaming
      if (window.gcodeStreamer?.isStreaming) {
        window.gcodeStreamer.stop();
      }

      // Notificar al usuario
      this.showEmergencyNotification(reason);
      
      // Emitir evento
      this.pluginManager.emit('emergency:triggered', { reason, timestamp: Date.now() });

    } catch (error) {
      console.error('Error ejecutando parada de emergencia:', error);
    }
  }

  // Limpiar estado de emergencia
  clearEmergencyState() {
    if (!this.emergencyTriggered) return;

    this.emergencyTriggered = false;
    console.log('✅ Estado de emergencia limpiado');
    
    this.pluginManager.emit('emergency:cleared', { timestamp: Date.now() });
  }

  // Configurar teclas de emergencia
  setupEmergencyKeys() {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+E = Emergency Stop
      if (event.ctrlKey && event.shiftKey && event.key === 'E') {
        event.preventDefault();
        this.triggerEmergencyStop('Parada de emergencia por teclado');
      }

      // F1 = Clear Emergency
      if (event.key === 'F1') {
        event.preventDefault();
        this.clearEmergencyState();
      }
    });
  }

  // Watchdog timer
  startWatchdog() {
    this.updateHeartbeat();
    
    this.watchdogTimer = setInterval(() => {
      const now = Date.now();
      if (now - this.lastHeartbeat > this.settings.watchdogTimeout) {
        console.warn('🐕 Watchdog timeout - posible bloqueo detectado');
        this.handleWatchdogTimeout();
      }
    }, this.settings.watchdogTimeout / 2);
  }

  stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  updateHeartbeat() {
    this.lastHeartbeat = Date.now();
  }

  handleWatchdogTimeout() {
    this.triggerEmergencyStop('Watchdog timeout - sistema no responde');
  }

  // Utilidades
  getCurrentProfile() {
    return this.safetyProfiles.get(this.settings.activeProfile);
  }

  isCommandAllowed(command, allowedCommands) {
    if (allowedCommands.length === 0) return true;

    const gcode = command.gcode || command.command || '';
    const commandCode = gcode.split(' ')[0].toUpperCase();
    
    return allowedCommands.includes(commandCode);
  }

  showSafetyWarning(title, message, type = 'warning') {
    return new Promise((resolve) => {
      const proceed = confirm(`${title}\n\n${message}\n\n¿Continuar de todos modos?`);
      resolve(proceed);
    });
  }

  showEmergencyNotification(reason) {
    if (this.settings.notifications.browser && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('🚨 PARADA DE EMERGENCIA', {
          body: reason,
          icon: '/assets/icons/icon-192.png',
          tag: 'emergency-stop',
          requireInteraction: true
        });
      }
    }

    if (this.settings.notifications.console) {
      console.error(`🚨 EMERGENCIA: ${reason}`);
    }
  }

  logSafetyStatus() {
    const profile = this.getCurrentProfile();
    console.log('🛡️ Estado de seguridad:');
    console.log(`  - Perfil activo: ${profile?.name || 'Ninguno'}`);
    console.log(`  - Protecciones: ${Object.keys(profile?.protections || {}).filter(k => profile.protections[k]).join(', ')}`);
    console.log(`  - Límites: Hotend ${profile?.restrictions.maxHotendTemp}°C, Cama ${profile?.restrictions.maxBedTemp}°C`);
    console.log(`  - Watchdog: ${this.watchdogTimer ? 'Activo' : 'Inactivo'}`);
  }

  // API pública
  loadProfile(profileName) {
    const profile = this.safetyProfiles.get(profileName);
    if (!profile) {
      console.warn(`Perfil de seguridad '${profileName}' no encontrado`);
      return false;
    }

    this.settings.activeProfile = profileName;
    console.log(`🔄 Perfil de seguridad cambiado a: ${profile.name}`);
    
    this.emit('profile:changed', { profile, profileName });
    return true;
  }

  createCustomProfile(name, config) {
    this.safetyProfiles.set(name, {
      name: config.name || name,
      description: config.description || 'Perfil personalizado',
      restrictions: { ...this.getDefaultSettings().restrictions, ...config.restrictions },
      protections: { ...config.protections },
      allowedCommands: config.allowedCommands || []
    });

    console.log(`➕ Perfil personalizado creado: ${name}`);
  }

  getAvailableProfiles() {
    return Array.from(this.safetyProfiles.entries()).map(([key, profile]) => ({
      key,
      name: profile.name,
      description: profile.description,
      active: key === this.settings.activeProfile
    }));
  }

  isInEmergencyState() {
    return this.emergencyTriggered;
  }

  getSecurityStatus() {
    const profile = this.getCurrentProfile();
    
    return {
      enabled: this.settings.enabled,
      activeProfile: this.settings.activeProfile,
      profileInfo: profile ? {
        name: profile.name,
        description: profile.description,
        protections: profile.protections,
        restrictions: profile.restrictions
      } : null,
      emergencyState: this.emergencyTriggered,
      watchdogActive: !!this.watchdogTimer,
      lastHeartbeat: this.lastHeartbeat,
      activeRestrictions: Array.from(this.activeRestrictions)
    };
  }

  // Configuración
  onSettingsChange(settings) {
    const wasEnabled = this.settings.enabled;
    this.settings = settings;

    if (settings.enabled && !wasEnabled) {
      this.initializeSafety();
    } else if (!settings.enabled && wasEnabled) {
      this.stopWatchdog();
      this.clearEmergencyState();
    }

    // Recargar perfil si cambió
    if (settings.activeProfile !== this.settings.activeProfile) {
      this.loadProfile(settings.activeProfile);
    }

    // Reiniciar watchdog si cambió el timeout
    if (this.watchdogTimer && settings.watchdogTimeout !== this.settings.watchdogTimeout) {
      this.stopWatchdog();
      if (settings.watchdogTimeout > 0) {
        this.startWatchdog();
      }
    }
  }
}
