// Utilidades de validación para Server3D

export class Validator {
  // Validar temperatura
  static validateTemperature(temp, type = 'hotend') {
    const numTemp = parseFloat(temp);
    if (isNaN(numTemp) || numTemp < 0) return false;
    
    switch (type) {
      case 'hotend':
        return numTemp <= (window.appConfig?.maxHotendTemp || 300);
      case 'bed':
        return numTemp <= (window.appConfig?.maxBedTemp || 120);
      default:
        return numTemp <= 300;
    }
  }

  // Validar velocidad de ventilador
  static validateFanSpeed(speed) {
    const numSpeed = parseInt(speed);
    return !isNaN(numSpeed) && numSpeed >= 0 && numSpeed <= 100;
  }

  // Validar coordenada de movimiento
  static validateMovement(distance) {
    const numDistance = parseFloat(distance);
    return !isNaN(numDistance) && Math.abs(numDistance) <= 1000; // Máximo 1000mm
  }

  // Validar velocidad de impresión
  static validatePrintSpeed(speed) {
    const numSpeed = parseInt(speed);
    return !isNaN(numSpeed) && numSpeed >= 1 && numSpeed <= 500; // 1% - 500%
  }

  // Validar comando G-code básico
  static validateGcode(command) {
    if (!command || typeof command !== 'string') return false;
    
    const trimmed = command.trim().toUpperCase();
    if (trimmed.length === 0) return false;
    
    // Comandos permitidos básicos
    const allowedCommands = [
      'G0', 'G1', 'G28', 'G90', 'G91', 'G92',
      'M104', 'M109', 'M140', 'M190', 'M105', 'M106', 'M107',
      'M84', 'M18', 'M114', 'M115', 'M220', 'M221'
    ];
    
    // Buscar comando al inicio
    for (const cmd of allowedCommands) {
      if (trimmed.startsWith(cmd)) return true;
    }
    
    // Permitir comentarios
    if (trimmed.startsWith(';')) return true;
    
    return false;
  }

  // Validar URL/host
  static validateHost(host) {
    if (!host || typeof host !== 'string') return false;
    
    // Remover protocolo si existe
    const cleanHost = host.replace(/^https?:\/\//, '');
    
    // Regex básico para IP:puerto o dominio:puerto
    const hostRegex = /^([a-zA-Z0-9.-]+)(:\d+)?$/;
    return hostRegex.test(cleanHost);
  }

  // Validar API key
  static validateApiKey(key) {
    if (!key || typeof key !== 'string') return false;
    // Mínimo 16 caracteres, máximo 128
    return key.length >= 16 && key.length <= 128;
  }

  // Validar archivo G-code
  static validateGcodeFile(file) {
    if (!file) return { valid: false, error: 'No file provided' };
    
    // Verificar tipo de archivo
    const allowedTypes = ['.gcode', '.g', '.txt'];
    const hasValidExtension = allowedTypes.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      return { 
        valid: false, 
        error: 'Tipo de archivo no válido. Use .gcode, .g o .txt' 
      };
    }
    
    // Verificar tamaño
    const maxSize = window.appConfig?.maxFileSize || 1024 * 1024; // 1MB default
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `Archivo muy grande. Máximo ${Math.round(maxSize/1024/1024)}MB` 
      };
    }
    
    return { valid: true };
  }

  // Sanitizar input del usuario
  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
      .trim()
      .replace(/[<>]/g, '') // Remover caracteres HTML básicos
      .substring(0, 1000); // Limitar longitud
  }

  // Validar rango numérico
  static validateRange(value, min, max) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
  }
}
