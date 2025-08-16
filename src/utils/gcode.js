// Utilidades de parser G-code para Server3D

export class GcodeParser {
  static parseFile(content) {
    const lines = content.split('\n');
    const parsed = {
      totalLines: lines.length,
      commands: [],
      metadata: {
        estimatedTime: null,
        filamentUsed: null,
        layerHeight: null,
        firstLayerTemp: null,
        bedTemp: null
      },
      stats: {
        movements: 0,
        heatingCommands: 0,
        comments: 0
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parsedLine = this.parseLine(line, i + 1);
      parsed.commands.push(parsedLine);

      // Extraer metadata de comentarios
      this.extractMetadata(line, parsed.metadata);

      // Contar estadísticas
      this.updateStats(parsedLine, parsed.stats);
    }

    return parsed;
  }

  static parseLine(line, lineNumber) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith(';')) {
      return {
        lineNumber,
        type: 'comment',
        raw: line,
        content: trimmed.substring(1).trim()
      };
    }

    if (trimmed === '') {
      return {
        lineNumber,
        type: 'empty',
        raw: line
      };
    }

    // Separar comando y comentario
    const commentIndex = trimmed.indexOf(';');
    const commandPart = commentIndex >= 0 ? trimmed.substring(0, commentIndex).trim() : trimmed;
    const comment = commentIndex >= 0 ? trimmed.substring(commentIndex + 1).trim() : null;

    // Parsear comando
    const tokens = commandPart.split(/\s+/);
    const command = tokens[0].toUpperCase();
    const parameters = {};

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.length >= 2) {
        const param = token[0].toUpperCase();
        const value = token.substring(1);
        parameters[param] = isNaN(value) ? value : parseFloat(value);
      }
    }

    return {
      lineNumber,
      type: 'command',
      raw: line,
      command,
      parameters,
      comment
    };
  }

  static extractMetadata(line, metadata) {
    const lower = line.toLowerCase();
    
    // Tiempo estimado
    if (lower.includes('estimated print time') || lower.includes('time:')) {
      const timeMatch = line.match(/(\d+):(\d+):(\d+)/);
      if (timeMatch) {
        const [, hours, minutes, seconds] = timeMatch;
        metadata.estimatedTime = `${hours}:${minutes}:${seconds}`;
      }
    }

    // Filamento usado
    if (lower.includes('filament used') || lower.includes('filament:')) {
      const filamentMatch = line.match(/(\d+\.?\d*)\s*m/i);
      if (filamentMatch) {
        metadata.filamentUsed = parseFloat(filamentMatch[1]);
      }
    }

    // Layer height
    if (lower.includes('layer height') || lower.includes('layer_height')) {
      const layerMatch = line.match(/(\d+\.?\d*)/);
      if (layerMatch) {
        metadata.layerHeight = parseFloat(layerMatch[1]);
      }
    }
  }

  static updateStats(parsedLine, stats) {
    if (parsedLine.type === 'comment') {
      stats.comments++;
    } else if (parsedLine.type === 'command') {
      const cmd = parsedLine.command;
      
      if (cmd === 'G0' || cmd === 'G1') {
        stats.movements++;
      } else if (cmd.startsWith('M1') && (cmd === 'M104' || cmd === 'M109' || cmd === 'M140' || cmd === 'M190')) {
        stats.heatingCommands++;
      }
    }
  }

  static getPreview(content, maxLines = 20) {
    const lines = content.split('\n');
    const preview = [];
    let commandCount = 0;

    for (let i = 0; i < lines.length && preview.length < maxLines; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith(';')) {
        // Incluir comentarios importantes
        const lower = line.toLowerCase();
        if (lower.includes('generated') || 
            lower.includes('time') || 
            lower.includes('filament') ||
            lower.includes('layer') ||
            lower.includes('temp')) {
          preview.push(line);
        }
      } else {
        preview.push(line);
        commandCount++;
        if (commandCount >= 10) break; // Máximo 10 comandos
      }
    }

    return preview.join('\n');
  }

  static validateGcode(content) {
    const lines = content.split('\n');
    const errors = [];
    const warnings = [];

    for (let i = 0; i < Math.min(lines.length, 1000); i++) { // Solo validar primeras 1000 líneas
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) continue;

      const parsed = this.parseLine(line, i + 1);
      if (parsed.type === 'command') {
        const validation = this.validateCommand(parsed);
        if (validation.error) {
          errors.push(`Línea ${i + 1}: ${validation.error}`);
        }
        if (validation.warning) {
          warnings.push(`Línea ${i + 1}: ${validation.warning}`);
        }
      }
    }

    return { errors, warnings };
  }

  static validateCommand(parsedCommand) {
    const { command, parameters } = parsedCommand;
    
    // Validaciones básicas por comando
    switch (command) {
      case 'M104': // Set hotend temperature
      case 'M109': // Set hotend temperature and wait
        if (parameters.S !== undefined && parameters.S > 300) {
          return { error: 'Temperatura del hotend muy alta (>300°C)' };
        }
        break;
        
      case 'M140': // Set bed temperature
      case 'M190': // Set bed temperature and wait
        if (parameters.S !== undefined && parameters.S > 120) {
          return { error: 'Temperatura de la cama muy alta (>120°C)' };
        }
        break;
        
      case 'G0':
      case 'G1':
        // Validar movimientos extremos
        ['X', 'Y', 'Z'].forEach(axis => {
          if (parameters[axis] !== undefined) {
            const value = Math.abs(parameters[axis]);
            if (value > 1000) {
              return { warning: `Movimiento muy grande en ${axis}: ${parameters[axis]}mm` };
            }
          }
        });
        
        // Validar velocidad
        if (parameters.F !== undefined && parameters.F > 10000) {
          return { warning: `Velocidad muy alta: ${parameters.F}mm/min` };
        }
        break;
    }

    return { error: null, warning: null };
  }

  static estimateProgress(commands, currentLine) {
    if (!commands.length) return 0;
    
    // Progreso simple basado en número de línea
    const lineProgress = (currentLine / commands.length) * 100;
    
    // TODO: Implementar progreso más sofisticado basado en tiempo/distancia
    return Math.min(Math.max(lineProgress, 0), 100);
  }

  static filterCommands(commands, options = {}) {
    const {
      includeComments = true,
      includeEmpty = false,
      commandTypes = null // ['G0', 'G1', 'M104', etc] o null para todos
    } = options;

    return commands.filter(cmd => {
      if (cmd.type === 'empty' && !includeEmpty) return false;
      if (cmd.type === 'comment' && !includeComments) return false;
      if (cmd.type === 'command' && commandTypes && !commandTypes.includes(cmd.command)) {
        return false;
      }
      return true;
    });
  }
}
