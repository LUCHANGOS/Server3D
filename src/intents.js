// IA local para comandos en español - Server3D

import { Validator } from './utils/validate.js';

export class IntentParser {
  constructor() {
    this.patterns = this.initializePatterns();
  }

  // Inicializar patrones de comandos
  initializePatterns() {
    return {
      // Comandos de temperatura
      temperature: {
        hotend: [
          /(?:poner|establecer|calentar|pone)\s+(?:hotend|extrusor|boquilla)\s+(?:a|en)\s+(\d+)\s*(?:grados?|°c?)?/i,
          /(?:temperatura|temp)\s+(?:hotend|extrusor|boquilla)\s+(\d+)/i,
          /hotend\s+(\d+)/i,
          /m104\s+s(\d+)/i
        ],
        bed: [
          /(?:poner|establecer|calentar|pone)\s+(?:cama|bed|mesa)\s+(?:a|en)\s+(\d+)\s*(?:grados?|°c?)?/i,
          /(?:temperatura|temp)\s+(?:cama|bed|mesa)\s+(\d+)/i,
          /(?:cama|bed)\s+(\d+)/i,
          /m140\s+s(\d+)/i
        ]
      },

      // Comandos de movimiento
      movement: {
        home: [
          /(?:home|casa|inicio)\s+(?:todo|all|todos?)/i,
          /(?:home|casa|inicio)$/i,
          /g28$/i
        ],
        homeAxis: [
          /(?:home|casa|inicio)\s+(?:eje\s+)?([xyz])/i,
          /g28\s+([xyz])/i
        ],
        move: [
          /(?:mover|mueve)\s+(?:eje\s+)?([xyz])\s+([+-]?\d+(?:\.\d+)?)\s*(?:mm|milimetros?)?/i,
          /([xyz])\s+([+-]?\d+(?:\.\d+)?)/i
        ]
      },

      // Control de impresión
      print: {
        start: [
          /(?:iniciar|empezar|comenzar)\s+(?:impresion|impresión|print)/i,
          /(?:imprimir|print)\s+(.+)/i,
          /(?:start|play)/i
        ],
        pause: [
          /(?:pausar|pausa)\s*(?:impresion|impresión)?/i,
          /pause/i
        ],
        resume: [
          /(?:reanudar|continuar|resume)\s*(?:impresion|impresión)?/i,
          /resume/i
        ],
        stop: [
          /(?:detener|parar|stop)\s*(?:impresion|impresión|todo)?/i,
          /(?:emergencia|emergency)/i,
          /stop/i
        ]
      },

      // Control de ventilador
      fan: [
        /(?:ventilador|fan)\s+(?:a|al|en)\s+(\d+)\s*(?:%|por\s+ciento)?/i,
        /(?:poner|establecer)\s+ventilador\s+(\d+)/i,
        /m106\s+s(\d+)/i
      ],

      // Velocidad de impresión
      speed: [
        /(?:velocidad|speed)\s+(?:a|al|en)\s+(\d+)\s*(?:%|por\s+ciento)?/i,
        /(?:feedrate|feed)\s+(\d+)/i,
        /m220\s+s(\d+)/i
      ],

      // Comandos G-code directos
      gcode: [
        /^([gm]\d+)(?:\s+(.+))?$/i
      ],

      // Consultas de estado
      status: [
        /(?:temperatura|temp)s?\s*$/i,
        /(?:posicion|posición|pos)\s*$/i,
        /(?:estado|status)\s*$/i,
        /m105/i,
        /m114/i
      ]
    };
  }

  // Parsear comando en español
  parseCommand(input) {
    const cleanInput = input.trim().toLowerCase();
    if (!cleanInput) {
      return { type: 'unknown', error: 'Comando vacío' };
    }

    try {
      // Intentar cada categoría de patrones
      for (const [category, patterns] of Object.entries(this.patterns)) {
        const result = this.matchCategory(category, patterns, cleanInput, input);
        if (result) {
          return result;
        }
      }

      return { 
        type: 'unknown', 
        error: 'Comando no reconocido',
        suggestion: this.getSuggestion(cleanInput)
      };
    } catch (error) {
      return { 
        type: 'error', 
        error: `Error procesando comando: ${error.message}` 
      };
    }
  }

  // Intentar hacer match con una categoría
  matchCategory(category, patterns, cleanInput, originalInput) {
    switch (category) {
      case 'temperature':
        return this.matchTemperature(patterns, cleanInput);
      case 'movement':
        return this.matchMovement(patterns, cleanInput);
      case 'print':
        return this.matchPrint(patterns, cleanInput, originalInput);
      case 'fan':
        return this.matchFan(patterns, cleanInput);
      case 'speed':
        return this.matchSpeed(patterns, cleanInput);
      case 'gcode':
        return this.matchGcode(patterns, originalInput);
      case 'status':
        return this.matchStatus(patterns, cleanInput);
      default:
        return null;
    }
  }

  // Temperatura
  matchTemperature(patterns, input) {
    for (const [tempType, regexes] of Object.entries(patterns)) {
      for (const regex of regexes) {
        const match = input.match(regex);
        if (match) {
          const temp = parseInt(match[1]);
          
          if (!Validator.validateTemperature(temp, tempType)) {
            return {
              type: 'error',
              error: `Temperatura inválida para ${tempType}: ${temp}°C`
            };
          }

          return {
            type: 'temperature',
            subtype: tempType,
            value: temp,
            gcode: tempType === 'hotend' ? `M104 S${temp}` : `M140 S${temp}`,
            description: `Establecer ${tempType} a ${temp}°C`
          };
        }
      }
    }
    return null;
  }

  // Movimiento
  matchMovement(patterns, input) {
    // Home all
    for (const regex of patterns.home) {
      if (input.match(regex)) {
        return {
          type: 'movement',
          subtype: 'home_all',
          gcode: 'G28',
          description: 'Home todos los ejes'
        };
      }
    }

    // Home axis
    for (const regex of patterns.homeAxis) {
      const match = input.match(regex);
      if (match) {
        const axis = match[1].toUpperCase();
        return {
          type: 'movement',
          subtype: 'home_axis',
          axis,
          gcode: `G28 ${axis}`,
          description: `Home eje ${axis}`
        };
      }
    }

    // Move
    for (const regex of patterns.move) {
      const match = input.match(regex);
      if (match) {
        const axis = match[1].toUpperCase();
        const distance = parseFloat(match[2]);
        
        if (!Validator.validateMovement(distance)) {
          return {
            type: 'error',
            error: `Distancia inválida: ${distance}mm`
          };
        }

        return {
          type: 'movement',
          subtype: 'move',
          axis,
          distance,
          gcode: `G91\nG1 ${axis}${distance}\nG90`,
          description: `Mover ${axis} ${distance}mm`
        };
      }
    }

    return null;
  }

  // Control de impresión
  matchPrint(patterns, input, originalInput) {
    // Start
    for (const regex of patterns.start) {
      const match = input.match(regex);
      if (match) {
        const filename = match[1] || null;
        return {
          type: 'print',
          subtype: 'start',
          filename,
          description: filename ? `Iniciar impresión: ${filename}` : 'Iniciar impresión'
        };
      }
    }

    // Pause
    for (const regex of patterns.pause) {
      if (input.match(regex)) {
        return {
          type: 'print',
          subtype: 'pause',
          gcode: 'M25',
          description: 'Pausar impresión'
        };
      }
    }

    // Resume
    for (const regex of patterns.resume) {
      if (input.match(regex)) {
        return {
          type: 'print',
          subtype: 'resume',
          gcode: 'M24',
          description: 'Reanudar impresión'
        };
      }
    }

    // Stop
    for (const regex of patterns.stop) {
      if (input.match(regex)) {
        return {
          type: 'print',
          subtype: 'stop',
          gcode: 'M25\nM104 S0\nM140 S0\nM107',
          description: 'Detener impresión y apagar calentadores'
        };
      }
    }

    return null;
  }

  // Ventilador
  matchFan(patterns, input) {
    for (const regex of patterns) {
      const match = input.match(regex);
      if (match) {
        const speed = parseInt(match[1]);
        
        if (!Validator.validateFanSpeed(speed)) {
          return {
            type: 'error',
            error: `Velocidad de ventilador inválida: ${speed}%`
          };
        }

        const pwmValue = Math.round((speed / 100) * 255);
        return {
          type: 'fan',
          value: speed,
          gcode: speed === 0 ? 'M107' : `M106 S${pwmValue}`,
          description: `Ventilador al ${speed}%`
        };
      }
    }
    return null;
  }

  // Velocidad
  matchSpeed(patterns, input) {
    for (const regex of patterns) {
      const match = input.match(regex);
      if (match) {
        const speed = parseInt(match[1]);
        
        if (!Validator.validatePrintSpeed(speed)) {
          return {
            type: 'error',
            error: `Velocidad inválida: ${speed}%`
          };
        }

        return {
          type: 'speed',
          value: speed,
          gcode: `M220 S${speed}`,
          description: `Velocidad al ${speed}%`
        };
      }
    }
    return null;
  }

  // G-code directo
  matchGcode(patterns, input) {
    for (const regex of patterns) {
      const match = input.match(regex);
      if (match) {
        const command = match[1].toUpperCase();
        const params = match[2] || '';
        const fullCommand = params ? `${command} ${params}` : command;
        
        if (!Validator.validateGcode(fullCommand)) {
          return {
            type: 'error',
            error: 'Comando G-code no permitido'
          };
        }

        return {
          type: 'gcode',
          command: fullCommand,
          gcode: fullCommand,
          description: `Ejecutar: ${fullCommand}`
        };
      }
    }
    return null;
  }

  // Estado
  matchStatus(patterns, input) {
    for (const regex of patterns) {
      if (input.match(regex)) {
        return {
          type: 'status',
          gcode: 'M105',
          description: 'Consultar estado'
        };
      }
    }
    return null;
  }

  // Sugerir comando similar
  getSuggestion(input) {
    const suggestions = [
      'poner hotend a 200 grados',
      'calentar cama a 60',
      'home todos los ejes',
      'mover eje X 10mm',
      'pausar impresión',
      'velocidad 120%',
      'ventilador 100%'
    ];

    // Simple similaridad basada en palabras comunes
    const inputWords = input.split(' ');
    let bestMatch = '';
    let maxScore = 0;

    for (const suggestion of suggestions) {
      const suggWords = suggestion.split(' ');
      let score = 0;
      
      for (const word of inputWords) {
        if (suggWords.some(sw => sw.includes(word) || word.includes(sw))) {
          score++;
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestMatch = suggestion;
      }
    }

    return maxScore > 0 ? `¿Quisiste decir "${bestMatch}"?` : null;
  }

  // Obtener ayuda de comandos
  getHelp() {
    return {
      temperature: [
        'poner hotend a 200 grados',
        'calentar cama a 60',
        'temperatura hotend 200'
      ],
      movement: [
        'home todos los ejes',
        'home eje X',
        'mover eje Y 10mm',
        'mover Z -5mm'
      ],
      print: [
        'iniciar impresión',
        'pausar impresión',
        'reanudar impresión',
        'detener todo'
      ],
      control: [
        'velocidad 120%',
        'ventilador 50%',
        'ventilador 0 (apagar)'
      ],
      status: [
        'temperatura',
        'posición',
        'estado'
      ]
    };
  }

  // Validar comando antes de ejecutar
  validateCommand(parsedCommand) {
    if (parsedCommand.type === 'error') {
      return parsedCommand;
    }

    // Validaciones adicionales según el contexto
    switch (parsedCommand.type) {
      case 'temperature':
        // Verificar si la impresora puede manejar la temperatura
        break;
      case 'movement':
        // Verificar límites de la impresora
        break;
      case 'print':
        // Verificar si hay un archivo cargado
        if (parsedCommand.subtype === 'start' && !parsedCommand.filename) {
          // Verificar si hay archivo en el streamer
          // Esta validación se haría en el nivel superior
        }
        break;
    }

    return parsedCommand;
  }
}

// Instancia global
export const intentParser = new IntentParser();
