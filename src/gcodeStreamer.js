// G-code Streamer para Server3D
import { store } from './store.js';
import { GcodeParser } from './utils/gcode.js';

export class GcodeStreamer {
  constructor() {
    this.isStreaming = false;
    this.currentFile = null;
    this.commands = [];
    this.currentIndex = 0;
    this.waitingForResponse = false;
    this.startTime = null;
    this.transport = null;
  }

  // Cargar archivo G-code
  async loadFile(file, content) {
    try {
      const parsed = GcodeParser.parseFile(content);
      
      this.currentFile = {
        name: file.name,
        size: file.size,
        content,
        parsed
      };
      
      this.commands = parsed.commands.filter(cmd => cmd.type === 'command');
      this.currentIndex = 0;
      
      store.setStreaming({
        currentFile: this.currentFile.name,
        totalLines: this.commands.length,
        currentLine: 0,
        progress: 0
      });
      
      // Guardar metadatos en Firebase
      if (window.fbClient?.isConnected()) {
        await window.fbClient.saveGcodeMetadata(file.name, parsed.metadata);
      }
      
      store.addConsoleMessage(`Archivo cargado: ${file.name} (${this.commands.length} comandos)`, 'info');
      return true;
    } catch (error) {
      store.addConsoleMessage(`Error cargando archivo: ${error.message}`, 'error');
      return false;
    }
  }

  // Iniciar streaming
  async start(transport) {
    if (!this.currentFile || !transport) {
      throw new Error('No hay archivo cargado o transporte disponible');
    }

    this.transport = transport;
    this.isStreaming = true;
    this.waitingForResponse = false;
    this.startTime = Date.now();
    this.currentIndex = 0;

    store.setStreaming({
      active: true,
      startTime: this.startTime,
      currentLine: 0,
      progress: 0
    });

    store.addConsoleMessage('Iniciando streaming de G-code...', 'info');
    
    // Iniciar el loop de streaming
    this.streamLoop();
  }

  // Loop principal de streaming
  async streamLoop() {
    while (this.isStreaming && this.currentIndex < this.commands.length) {
      if (!this.waitingForResponse) {
        await this.sendNextCommand();
      }
      
      // Esperar un poco antes de la siguiente iteración
      await this.delay(10);
    }

    if (this.currentIndex >= this.commands.length) {
      this.complete();
    }
  }

  // Enviar siguiente comando
  async sendNextCommand() {
    if (this.currentIndex >= this.commands.length) return;

    const command = this.commands[this.currentIndex];
    this.waitingForResponse = true;

    try {
      await this.transport.sendCommand(command.raw);
      
      store.addConsoleMessage(`> ${command.raw}`, 'info');
      
      // Actualizar progreso
      this.currentIndex++;
      const progress = (this.currentIndex / this.commands.length) * 100;
      
      store.setStreaming({
        currentLine: this.currentIndex,
        progress: Math.round(progress),
        elapsedTime: Date.now() - this.startTime
      });

    } catch (error) {
      store.addConsoleMessage(`Error enviando comando: ${error.message}`, 'error');
      this.stop();
    }
  }

  // Manejar respuesta de la impresora
  handleResponse(response) {
    if (!this.isStreaming) return;

    const responseText = response.toLowerCase();
    
    if (responseText.includes('ok') || responseText.includes('busy')) {
      this.waitingForResponse = false;
    } else if (responseText.includes('error')) {
      store.addConsoleMessage(`Error de impresora: ${response}`, 'error');
      this.pause();
    }
    
    store.addConsoleMessage(`< ${response}`, 'info');
  }

  // Pausar streaming
  pause() {
    this.isStreaming = false;
    this.waitingForResponse = false;
    
    store.setStreaming({ active: false });
    store.addConsoleMessage('Streaming pausado', 'warning');
  }

  // Reanudar streaming
  resume() {
    if (this.currentFile && this.currentIndex < this.commands.length) {
      this.isStreaming = true;
      
      store.setStreaming({ active: true });
      store.addConsoleMessage('Streaming reanudado', 'info');
      
      this.streamLoop();
    }
  }

  // Detener streaming
  stop() {
    this.isStreaming = false;
    this.waitingForResponse = false;
    
    store.setStreaming({
      active: false,
      currentLine: 0,
      progress: 0
    });
    
    store.addConsoleMessage('Streaming detenido', 'warning');
  }

  // Completar streaming
  complete() {
    this.isStreaming = false;
    this.waitingForResponse = false;
    
    const elapsedTime = Date.now() - this.startTime;
    
    store.setStreaming({
      active: false,
      progress: 100,
      elapsedTime
    });
    
    store.addConsoleMessage(`Streaming completado en ${Math.round(elapsedTime/1000)}s`, 'info');
  }

  // Utilidad para delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Obtener estadísticas
  getStats() {
    return {
      isStreaming: this.isStreaming,
      currentFile: this.currentFile?.name,
      progress: this.currentIndex / this.commands.length * 100,
      currentLine: this.currentIndex,
      totalLines: this.commands.length,
      elapsedTime: this.startTime ? Date.now() - this.startTime : 0
    };
  }
}

export const gcodeStreamer = new GcodeStreamer();
