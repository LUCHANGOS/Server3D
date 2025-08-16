// Cliente Firebase para Server3D

import { store } from './store.js';

export class FirebaseClient {
  constructor() {
    this.app = null;
    this.auth = null;
    this.database = null;
    this.user = null;
    this.userRef = null;
  }

  // Inicializar Firebase
  async initialize() {
    try {
      if (!window.firebaseConfig) {
        throw new Error('Firebase config no encontrado. Verifica config.js');
      }

      // Inicializar Firebase
      this.app = firebase.initializeApp(window.firebaseConfig);
      this.auth = firebase.auth();
      this.database = firebase.database();

      console.log('Firebase inicializado correctamente');

      // Configurar listener de autenticación
      this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));

      // Autenticar anónimamente
      await this.signInAnonymously();

      return true;
    } catch (error) {
      console.error('Error inicializando Firebase:', error);
      store.addConsoleMessage(`Error Firebase: ${error.message}`, 'error');
      return false;
    }
  }

  // Autenticación anónima
  async signInAnonymously() {
    try {
      const result = await this.auth.signInAnonymously();
      console.log('Usuario anónimo autenticado:', result.user.uid);
      return result.user;
    } catch (error) {
      console.error('Error en autenticación anónima:', error);
      throw error;
    }
  }

  // Listener de cambios de autenticación
  onAuthStateChanged(user) {
    if (user) {
      this.user = user;
      this.userRef = this.database.ref(`users/${user.uid}`);
      
      store.setState({
        user: {
          uid: user.uid,
          connected: true
        }
      });

      store.addConsoleMessage(`Usuario conectado: ${user.uid.substring(0, 8)}...`, 'info');
      
      // Configurar listeners de la base de datos
      this.setupDatabaseListeners();
      
      // Inicializar datos del usuario si no existen
      this.initializeUserData();
      
    } else {
      this.user = null;
      this.userRef = null;
      
      store.setState({
        user: {
          uid: null,
          connected: false
        }
      });
      
      store.addConsoleMessage('Usuario desconectado', 'warning');
    }
  }

  // Configurar listeners de la base de datos
  setupDatabaseListeners() {
    if (!this.userRef) return;

    // Escuchar cambios en el estado de la impresora
    this.userRef.child('printer').on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        store.setState({ printer: data });
      }
    });

    // Escuchar comandos remotos
    this.userRef.child('commands').on('child_added', (snapshot) => {
      const command = snapshot.val();
      if (command && command.timestamp > Date.now() - 30000) { // Solo comandos de últimos 30 segundos
        this.handleRemoteCommand(command, snapshot.key);
      }
    });
  }

  // Inicializar datos del usuario
  async initializeUserData() {
    try {
      const snapshot = await this.userRef.once('value');
      if (!snapshot.exists()) {
        // Crear estructura inicial
        await this.userRef.set({
          created: firebase.database.ServerValue.TIMESTAMP,
          printer: {
            temperatures: {
              hotend: { current: 0, target: 0 },
              bed: { current: 0, target: 0 }
            },
            position: { x: 0, y: 0, z: 0 },
            fanSpeed: 0,
            printSpeed: 100,
            state: 'idle'
          },
          settings: {
            maxHotendTemp: window.appConfig?.maxHotendTemp || 300,
            maxBedTemp: window.appConfig?.maxBedTemp || 120,
            autoSync: true
          }
        });
        
        console.log('Datos de usuario inicializados');
      }
    } catch (error) {
      console.error('Error inicializando datos de usuario:', error);
    }
  }

  // Manejar comandos remotos
  async handleRemoteCommand(command, commandKey) {
    try {
      console.log('Comando remoto recibido:', command);
      
      // Procesar comando según tipo
      switch (command.type) {
        case 'gcode':
          if (window.currentTransport && window.currentTransport.sendCommand) {
            await window.currentTransport.sendCommand(command.data);
            store.addConsoleMessage(`Comando remoto ejecutado: ${command.data}`, 'info');
          }
          break;
          
        case 'emergency_stop':
          if (window.currentTransport && window.currentTransport.sendCommand) {
            await window.currentTransport.sendCommand('M112'); // Emergency stop
            store.addConsoleMessage('¡PARADA DE EMERGENCIA REMOTA!', 'error');
          }
          break;
          
        default:
          console.warn('Tipo de comando remoto desconocido:', command.type);
      }
      
      // Marcar comando como procesado
      await this.userRef.child('commands').child(commandKey).remove();
      
    } catch (error) {
      console.error('Error procesando comando remoto:', error);
      store.addConsoleMessage(`Error en comando remoto: ${error.message}`, 'error');
    }
  }

  // Sincronizar estado de la impresora
  async syncPrinterState(printerState) {
    if (!this.userRef) return;

    try {
      await this.userRef.child('printer').update({
        ...printerState,
        lastUpdate: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (error) {
      console.error('Error sincronizando estado:', error);
    }
  }

  // Guardar metadatos de archivo G-code
  async saveGcodeMetadata(filename, metadata) {
    if (!this.userRef) return;

    try {
      await this.userRef.child('files').push({
        filename,
        metadata,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      
      store.addConsoleMessage(`Metadatos guardados: ${filename}`, 'info');
    } catch (error) {
      console.error('Error guardando metadatos:', error);
    }
  }

  // Obtener historial de archivos
  async getFileHistory(limit = 10) {
    if (!this.userRef) return [];

    try {
      const snapshot = await this.userRef.child('files')
        .orderByChild('timestamp')
        .limitToLast(limit)
        .once('value');
        
      const files = [];
      snapshot.forEach((child) => {
        files.unshift({
          id: child.key,
          ...child.val()
        });
      });
      
      return files;
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }
  }

  // Registrar error
  async logError(message, details = null) {
    if (!this.userRef) return;

    try {
      await this.userRef.child('errors').push({
        message,
        details,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error registrando error:', error);
    }
  }

  // Obtener configuración del usuario
  async getUserSettings() {
    if (!this.userRef) return {};

    try {
      const snapshot = await this.userRef.child('settings').once('value');
      return snapshot.val() || {};
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      return {};
    }
  }

  // Actualizar configuración del usuario
  async updateUserSettings(settings) {
    if (!this.userRef) return;

    try {
      await this.userRef.child('settings').update(settings);
      store.addConsoleMessage('Configuración actualizada', 'info');
    } catch (error) {
      console.error('Error actualizando configuración:', error);
    }
  }

  // Compartir sesión (generar código de acceso)
  async shareSession() {
    if (!this.userRef) return null;

    try {
      const shareCode = this.generateShareCode();
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
      
      await this.database.ref(`shared/${shareCode}`).set({
        userId: this.user.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        expiresAt,
        active: true
      });
      
      store.addConsoleMessage(`Sesión compartida: ${shareCode}`, 'info');
      return shareCode;
    } catch (error) {
      console.error('Error compartiendo sesión:', error);
      return null;
    }
  }

  // Acceder a sesión compartida
  async accessSharedSession(shareCode) {
    try {
      const snapshot = await this.database.ref(`shared/${shareCode}`).once('value');
      const shareData = snapshot.val();
      
      if (!shareData || !shareData.active || shareData.expiresAt < Date.now()) {
        throw new Error('Código de acceso inválido o expirado');
      }
      
      // Configurar listeners para la sesión compartida
      const sharedUserRef = this.database.ref(`users/${shareData.userId}`);
      
      sharedUserRef.child('printer').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
          store.setState({ printer: data });
        }
      });
      
      store.addConsoleMessage(`Conectado a sesión compartida: ${shareData.userId.substring(0, 8)}...`, 'info');
      return true;
    } catch (error) {
      console.error('Error accediendo a sesión compartida:', error);
      store.addConsoleMessage(`Error: ${error.message}`, 'error');
      return false;
    }
  }

  // Generar código de compartir
  generateShareCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Verificar si está conectado
  isConnected() {
    return this.user !== null && this.userRef !== null;
  }

  // Desconectar
  async disconnect() {
    try {
      if (this.userRef) {
        // Limpiar listeners
        this.userRef.off();
      }
      
      if (this.auth) {
        await this.auth.signOut();
      }
      
      store.addConsoleMessage('Firebase desconectado', 'info');
    } catch (error) {
      console.error('Error desconectando Firebase:', error);
    }
  }
}

// Instancia global
export const fbClient = new FirebaseClient();

// Hacer disponible globalmente
window.fbClient = fbClient;

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    fbClient.initialize();
  });
} else {
  fbClient.initialize();
}
