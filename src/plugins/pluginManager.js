// Sistema de plugins para Server3D - Extensibilidad avanzada

export class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.events = new EventTarget();
    this.initialized = false;
  }

  // Inicializar sistema de plugins
  async init() {
    console.log('🔌 Inicializando sistema de plugins...');
    
    // Registrar hooks básicos
    this.registerHooks();
    
    // Cargar plugins del core
    await this.loadCorePlugins();
    
    this.initialized = true;
    this.emit('system:plugins:ready');
    
    console.log(`✅ Sistema de plugins listo (${this.plugins.size} plugins)`);
  }

  // Registrar hooks del sistema
  registerHooks() {
    const hooks = [
      'before:connect',
      'after:connect', 
      'before:disconnect',
      'after:disconnect',
      'before:command',
      'after:command',
      'before:gcode:stream',
      'after:gcode:stream',
      'temperature:update',
      'position:update',
      'print:status:change',
      'error:occurred',
      'ui:render',
      'settings:change'
    ];

    hooks.forEach(hook => {
      this.hooks.set(hook, []);
    });
  }

  // Registrar un plugin
  registerPlugin(name, plugin) {
    if (this.plugins.has(name)) {
      throw new Error(`Plugin '${name}' ya está registrado`);
    }

    // Validar estructura del plugin
    if (!this.validatePlugin(plugin)) {
      throw new Error(`Plugin '${name}' no tiene la estructura requerida`);
    }

    this.plugins.set(name, {
      instance: plugin,
      active: false,
      metadata: plugin.getMetadata(),
      hooks: [],
      settings: plugin.getDefaultSettings?.() || {}
    });

    console.log(`🔌 Plugin registrado: ${name} v${plugin.getMetadata().version}`);
  }

  // Activar plugin
  async activatePlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' no encontrado`);
    }

    if (plugin.active) {
      console.warn(`Plugin '${name}' ya está activo`);
      return;
    }

    try {
      // Activar plugin
      await plugin.instance.activate(this);
      plugin.active = true;

      console.log(`✅ Plugin activado: ${name}`);
      this.emit('plugin:activated', { name, plugin: plugin.instance });
    } catch (error) {
      console.error(`Error activando plugin '${name}':`, error);
      throw error;
    }
  }

  // Desactivar plugin
  async deactivatePlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin || !plugin.active) {
      return;
    }

    try {
      await plugin.instance.deactivate();
      plugin.active = false;

      // Remover hooks registrados
      plugin.hooks.forEach(({ hook, callback }) => {
        this.removeHook(hook, callback);
      });
      plugin.hooks = [];

      console.log(`🔌 Plugin desactivado: ${name}`);
      this.emit('plugin:deactivated', { name, plugin: plugin.instance });
    } catch (error) {
      console.error(`Error desactivando plugin '${name}':`, error);
      throw error;
    }
  }

  // Registrar hook
  addHook(hookName, callback, priority = 10) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    const hook = { callback, priority };
    const hookList = this.hooks.get(hookName);
    
    // Insertar manteniendo orden por prioridad
    const index = hookList.findIndex(h => h.priority > priority);
    if (index === -1) {
      hookList.push(hook);
    } else {
      hookList.splice(index, 0, hook);
    }

    return () => this.removeHook(hookName, callback);
  }

  // Remover hook
  removeHook(hookName, callback) {
    const hookList = this.hooks.get(hookName);
    if (!hookList) return;

    const index = hookList.findIndex(h => h.callback === callback);
    if (index !== -1) {
      hookList.splice(index, 1);
    }
  }

  // Ejecutar hooks
  async executeHook(hookName, data = {}, options = {}) {
    const hookList = this.hooks.get(hookName);
    if (!hookList || hookList.length === 0) {
      return data;
    }

    let result = data;

    for (const hook of hookList) {
      try {
        const hookResult = await hook.callback(result, options);
        
        // Si retorna explícitamente algo, usar ese valor
        if (hookResult !== undefined) {
          result = hookResult;
        }

        // Si el hook cancela la operación
        if (options.cancellable && result?.__cancelled) {
          break;
        }
      } catch (error) {
        console.error(`Error en hook '${hookName}':`, error);
        this.emit('hook:error', { hookName, error });

        if (options.throwOnError) {
          throw error;
        }
      }
    }

    return result;
  }

  // Emitir evento
  emit(eventName, data = {}) {
    const event = new CustomEvent(eventName, { detail: data });
    this.events.dispatchEvent(event);
  }

  // Escuchar evento
  on(eventName, callback) {
    this.events.addEventListener(eventName, callback);
    return () => this.events.removeEventListener(eventName, callback);
  }

  // Validar plugin
  validatePlugin(plugin) {
    const required = ['getMetadata', 'activate', 'deactivate'];
    return required.every(method => typeof plugin[method] === 'function');
  }

  // Cargar plugins del core
  async loadCorePlugins() {
    const corePlugins = [
      { name: 'temperatureMonitor', required: true },
      { name: 'gcodeAnalyzer', required: true },
      { name: 'printEstimator', required: false },
      { name: 'safetyManager', required: true },
      { name: 'historyLogger', required: true },
      { name: 'costCalculator', required: true }
    ];

    let loadedCount = 0;
    let errorCount = 0;

    for (const pluginInfo of corePlugins) {
      const { name, required } = pluginInfo;
      
      try {
        const module = await import(`./core/${name}.js`);
        const PluginClass = module.default || module[Object.keys(module)[0]];
        
        if (!PluginClass) {
          throw new Error(`No se encontró la clase del plugin en ${name}.js`);
        }
        
        const plugin = new PluginClass();
        this.registerPlugin(name, plugin);
        await this.activatePlugin(name);
        
        loadedCount++;
        console.log(`✅ Plugin core cargado: ${name}`);
        
      } catch (error) {
        errorCount++;
        
        if (required) {
          console.error(`❌ Error cargando plugin core requerido '${name}':`, error.message);
        } else {
          console.warn(`⚠️ Plugin core opcional '${name}' no disponible:`, error.message);
        }
        
        // Intentar crear un plugin dummy para los opcionales
        if (!required) {
          this.createDummyPlugin(name);
        }
      }
    }

    console.log(`🔌 Core plugins: ${loadedCount} cargados, ${errorCount} con errores`);
  }

  // Crear plugin dummy para reemplazar los faltantes
  createDummyPlugin(name) {
    try {
      const dummyPlugin = {
        name: name,
        version: '0.0.0-dummy',
        
        getMetadata() {
          return {
            name: this.name,
            version: this.version,
            description: `Plugin dummy para ${name} (no disponible)`,
            author: 'Server3D',
            website: '',
            dependencies: [],
            isDummy: true
          };
        },
        
        async activate() {
          console.log(`🤖 Plugin dummy activado: ${this.name}`);
          return true;
        },
        
        async deactivate() {
          console.log(`🤖 Plugin dummy desactivado: ${this.name}`);
          return true;
        },
        
        getDefaultSettings() {
          return {};
        }
      };
      
      this.registerPlugin(name, dummyPlugin);
      this.activatePlugin(name);
      
    } catch (error) {
      console.error(`Error creando plugin dummy para '${name}':`, error);
    }
  }

  // Obtener plugin
  getPlugin(name) {
    return this.plugins.get(name)?.instance;
  }

  // Listar plugins
  listPlugins() {
    return Array.from(this.plugins.entries()).map(([name, plugin]) => ({
      name,
      active: plugin.active,
      metadata: plugin.metadata,
      settings: plugin.settings
    }));
  }

  // Configurar plugin
  configurePlugin(name, settings) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' no encontrado`);
    }

    plugin.settings = { ...plugin.settings, ...settings };
    
    if (plugin.active && plugin.instance.onSettingsChange) {
      plugin.instance.onSettingsChange(plugin.settings);
    }

    this.emit('plugin:configured', { name, settings: plugin.settings });
  }

  // Información de debug
  getDebugInfo() {
    return {
      initialized: this.initialized,
      pluginCount: this.plugins.size,
      activePlugins: this.listPlugins().filter(p => p.active).length,
      hooks: Object.fromEntries(
        Array.from(this.hooks.entries()).map(([name, hooks]) => [name, hooks.length])
      )
    };
  }
}

// Clase base para plugins
export class BasePlugin {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this.pluginManager = null;
  }

  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: 'Plugin base',
      author: 'Server3D',
      website: '',
      dependencies: []
    };
  }

  async activate(pluginManager) {
    this.pluginManager = pluginManager;
    console.log(`Activando plugin: ${this.name}`);
  }

  async deactivate() {
    console.log(`Desactivando plugin: ${this.name}`);
    this.pluginManager = null;
  }

  getDefaultSettings() {
    return {};
  }

  // Utilidades para plugins
  addHook(hookName, callback, priority = 10) {
    if (!this.pluginManager) return;
    
    const removeHook = this.pluginManager.addHook(hookName, callback, priority);
    
    // Rastrear hooks para limpieza
    const plugin = this.pluginManager.plugins.get(this.name);
    if (plugin) {
      plugin.hooks.push({ hook: hookName, callback });
    }
    
    return removeHook;
  }

  emit(eventName, data = {}) {
    if (this.pluginManager) {
      this.pluginManager.emit(`plugin:${this.name}:${eventName}`, data);
    }
  }

  on(eventName, callback) {
    if (this.pluginManager) {
      return this.pluginManager.on(eventName, callback);
    }
  }
}

// Instancia global
export const pluginManager = new PluginManager();
