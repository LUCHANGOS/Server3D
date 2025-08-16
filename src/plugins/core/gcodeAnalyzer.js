// Plugin de análisis avanzado de G-code

import { BasePlugin } from '../pluginManager.js';

export default class GcodeAnalyzerPlugin extends BasePlugin {
  constructor() {
    super('gcodeAnalyzer', '1.0.0');
    
    this.currentAnalysis = null;
    this.analysisCache = new Map();
    this.stats = {
      filesAnalyzed: 0,
      totalLines: 0,
      estimatedTime: 0,
      materialUsed: 0
    };
  }

  getMetadata() {
    return {
      name: 'Analizador de G-code',
      version: this.version,
      description: 'Análisis inteligente de archivos G-code con predicciones y optimizaciones',
      author: 'Server3D Core Team',
      website: 'https://github.com/LUCHANGOS/Server3D',
      dependencies: []
    };
  }

  getDefaultSettings() {
    return {
      enabled: true,
      cacheAnalysis: true,
      deepAnalysis: true,
      materialTracking: true,
      timeEstimation: true,
      qualityAnalysis: true,
      optimizationSuggestions: true,
      layerAnalysis: true,
      thermalAnalysis: true,
      maxFileSizeMB: 50
    };
  }

  async activate(pluginManager) {
    await super.activate(pluginManager);
    
    this.settings = {
      ...this.getDefaultSettings(),
      ...pluginManager.plugins.get(this.name)?.settings
    };

    // Registrar hooks
    this.addHook('before:gcode:stream', this.analyzeGcodeFile.bind(this), 1);
    this.addHook('gcode:loaded', this.onGcodeLoaded.bind(this), 5);

    console.log('📊 Analizador de G-code activado');
  }

  // Hook: Antes de iniciar streaming
  async analyzeGcodeFile(data) {
    if (!this.settings.enabled || !data.gcode) return data;

    try {
      const analysis = await this.performAnalysis(data.gcode, data.filename);
      
      return {
        ...data,
        analysis,
        metadata: {
          ...data.metadata,
          ...analysis.metadata
        }
      };
    } catch (error) {
      console.error('Error analizando G-code:', error);
      return data;
    }
  }

  // Hook: G-code cargado
  async onGcodeLoaded(data) {
    if (this.settings.enabled && data.gcode) {
      this.currentAnalysis = await this.performAnalysis(data.gcode, data.filename);
      this.emit('analysis:completed', this.currentAnalysis);
    }
    return data;
  }

  // Análisis principal
  async performAnalysis(gcode, filename = 'unnamed.gcode') {
    const startTime = Date.now();
    
    // Verificar caché
    const cacheKey = this.generateCacheKey(gcode);
    if (this.settings.cacheAnalysis && this.analysisCache.has(cacheKey)) {
      console.log('📋 Usando análisis en caché');
      return this.analysisCache.get(cacheKey);
    }

    const lines = gcode.split('\n').filter(line => line.trim());
    
    console.log(`📊 Analizando G-code: ${lines.length} líneas...`);

    const analysis = {
      filename,
      timestamp: Date.now(),
      lineCount: lines.length,
      fileSize: gcode.length,
      metadata: {},
      layers: {},
      movements: {},
      temperatures: {},
      materials: {},
      timing: {},
      quality: {},
      issues: [],
      suggestions: [],
      summary: {}
    };

    // Análisis básico
    await this.analyzeBasicStats(lines, analysis);
    
    // Análisis de movimientos
    await this.analyzeMovements(lines, analysis);
    
    // Análisis térmico
    if (this.settings.thermalAnalysis) {
      await this.analyzeThermalProfile(lines, analysis);
    }
    
    // Análisis de capas
    if (this.settings.layerAnalysis) {
      await this.analyzeLayers(lines, analysis);
    }
    
    // Análisis de calidad
    if (this.settings.qualityAnalysis) {
      await this.analyzeQuality(lines, analysis);
    }
    
    // Estimación de tiempo
    if (this.settings.timeEstimation) {
      await this.estimatePrintTime(analysis);
    }
    
    // Sugerencias de optimización
    if (this.settings.optimizationSuggestions) {
      await this.generateOptimizationSuggestions(analysis);
    }

    // Generar resumen
    this.generateSummary(analysis);

    const analysisTime = Date.now() - startTime;
    analysis.analysisTime = analysisTime;

    console.log(`✅ Análisis completado en ${analysisTime}ms`);

    // Guardar en caché
    if (this.settings.cacheAnalysis) {
      this.analysisCache.set(cacheKey, analysis);
    }

    // Actualizar estadísticas
    this.updateStats(analysis);

    return analysis;
  }

  // Análisis de estadísticas básicas
  async analyzeBasicStats(lines, analysis) {
    let commentLines = 0;
    let gcodeCommands = 0;
    const commandCounts = new Map();

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith(';')) {
        commentLines++;
        this.extractMetadataFromComment(trimmed, analysis);
      } else if (trimmed) {
        gcodeCommands++;
        const command = trimmed.split(' ')[0].toUpperCase();
        commandCounts.set(command, (commandCounts.get(command) || 0) + 1);
      }
    }

    analysis.metadata = {
      ...analysis.metadata,
      commentLines,
      gcodeCommands,
      commandDistribution: Object.fromEntries(commandCounts)
    };
  }

  // Extraer metadatos de comentarios
  extractMetadataFromComment(comment, analysis) {
    const cleanComment = comment.slice(1).trim();
    
    // Detectar información del slicer
    if (cleanComment.includes('generated by') || cleanComment.includes('Sliced by')) {
      analysis.metadata.slicer = cleanComment;
    }
    
    // Información de filamento
    if (cleanComment.includes('filament used')) {
      const match = cleanComment.match(/(\d+(?:\.\d+)?)\s*mm/);
      if (match) {
        analysis.materials.filamentLength = parseFloat(match[1]);
      }
    }
    
    // Tiempo estimado del slicer
    if (cleanComment.includes('estimated printing time')) {
      const timeMatch = cleanComment.match(/(\d+h\s*\d+m|\d+m\s*\d+s|\d+:\d+:\d+)/);
      if (timeMatch) {
        analysis.timing.slicerEstimate = timeMatch[1];
      }
    }

    // Configuraciones
    if (cleanComment.includes('layer_height')) {
      const match = cleanComment.match(/layer_height = ([\d.]+)/);
      if (match) {
        analysis.metadata.layerHeight = parseFloat(match[1]);
      }
    }

    if (cleanComment.includes('first_layer_height')) {
      const match = cleanComment.match(/first_layer_height = ([\d.]+)/);
      if (match) {
        analysis.metadata.firstLayerHeight = parseFloat(match[1]);
      }
    }
  }

  // Análisis de movimientos
  async analyzeMovements(lines, analysis) {
    let totalDistance = 0;
    let extrusionDistance = 0;
    let travelDistance = 0;
    let currentPos = { x: 0, y: 0, z: 0, e: 0 };
    let maxPos = { x: 0, y: 0, z: 0 };
    let minPos = { x: 0, y: 0, z: 0 };

    const speeds = [];
    let currentSpeed = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';')) continue;

      const parts = trimmed.split(' ');
      const command = parts[0].toUpperCase();

      if (command === 'G0' || command === 'G1') {
        const newPos = { ...currentPos };
        let hasExtrusion = false;
        let moveSpeed = currentSpeed;

        for (const part of parts.slice(1)) {
          const axis = part[0].toUpperCase();
          const value = parseFloat(part.slice(1));

          if (axis === 'X') newPos.x = value;
          else if (axis === 'Y') newPos.y = value;
          else if (axis === 'Z') newPos.z = value;
          else if (axis === 'E') {
            newPos.e = value;
            hasExtrusion = true;
          }
          else if (axis === 'F') {
            moveSpeed = value;
            speeds.push(value);
          }
        }

        // Calcular distancia
        const distance = this.calculateDistance3D(currentPos, newPos);
        totalDistance += distance;

        if (hasExtrusion) {
          extrusionDistance += distance;
        } else {
          travelDistance += distance;
        }

        // Actualizar límites
        maxPos.x = Math.max(maxPos.x, newPos.x);
        maxPos.y = Math.max(maxPos.y, newPos.y);
        maxPos.z = Math.max(maxPos.z, newPos.z);
        minPos.x = Math.min(minPos.x, newPos.x);
        minPos.y = Math.min(minPos.y, newPos.y);
        minPos.z = Math.min(minPos.z, newPos.z);

        currentPos = newPos;
      } else if (command === 'G92') {
        // Reset de coordenadas
        for (const part of parts.slice(1)) {
          const axis = part[0].toUpperCase();
          const value = parseFloat(part.slice(1));
          if (axis === 'E') currentPos.e = value;
        }
      }
    }

    analysis.movements = {
      totalDistance: totalDistance.toFixed(2),
      extrusionDistance: extrusionDistance.toFixed(2),
      travelDistance: travelDistance.toFixed(2),
      travelPercentage: ((travelDistance / totalDistance) * 100).toFixed(1),
      buildVolume: {
        x: maxPos.x - minPos.x,
        y: maxPos.y - minPos.y,
        z: maxPos.z - minPos.z
      },
      bounds: { min: minPos, max: maxPos },
      speeds: {
        average: speeds.length > 0 ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(0) : 0,
        min: speeds.length > 0 ? Math.min(...speeds) : 0,
        max: speeds.length > 0 ? Math.max(...speeds) : 0,
        unique: [...new Set(speeds)].length
      }
    };
  }

  // Análisis térmico
  async analyzeThermalProfile(lines, analysis) {
    const hotendTemps = [];
    const bedTemps = [];
    const tempChanges = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';')) continue;

      const parts = trimmed.split(' ');
      const command = parts[0].toUpperCase();

      if (command === 'M104' || command === 'M109') {
        // Hotend temperature
        const sParam = parts.find(p => p.startsWith('S'));
        if (sParam) {
          const temp = parseFloat(sParam.slice(1));
          hotendTemps.push(temp);
          tempChanges.push({ type: 'hotend', temp, line: trimmed });
        }
      } else if (command === 'M140' || command === 'M190') {
        // Bed temperature
        const sParam = parts.find(p => p.startsWith('S'));
        if (sParam) {
          const temp = parseFloat(sParam.slice(1));
          bedTemps.push(temp);
          tempChanges.push({ type: 'bed', temp, line: trimmed });
        }
      }
    }

    analysis.temperatures = {
      hotend: {
        temperatures: [...new Set(hotendTemps)],
        max: hotendTemps.length > 0 ? Math.max(...hotendTemps) : 0,
        min: hotendTemps.length > 0 ? Math.min(...hotendTemps) : 0,
        changes: hotendTemps.length
      },
      bed: {
        temperatures: [...new Set(bedTemps)],
        max: bedTemps.length > 0 ? Math.max(...bedTemps) : 0,
        min: bedTemps.length > 0 ? Math.min(...bedTemps) : 0,
        changes: bedTemps.length
      },
      profile: tempChanges
    };
  }

  // Análisis de capas
  async analyzeLayers(lines, analysis) {
    const layerChanges = [];
    let currentZ = 0;
    let layerCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detectar cambios de capa por comentarios
      if (line.includes(';LAYER:') || line.includes('layer')) {
        layerCount++;
        layerChanges.push({ layer: layerCount, line: i, z: currentZ });
      }
      
      // Detectar por movimientos Z
      if (line.includes('G0') || line.includes('G1')) {
        const zMatch = line.match(/Z([\d.-]+)/);
        if (zMatch) {
          const newZ = parseFloat(zMatch[1]);
          if (newZ > currentZ + 0.1) { // Cambio significativo en Z
            currentZ = newZ;
            if (!layerChanges.some(l => Math.abs(l.z - currentZ) < 0.1)) {
              layerCount++;
              layerChanges.push({ layer: layerCount, line: i, z: currentZ });
            }
          }
        }
      }
    }

    analysis.layers = {
      count: layerCount,
      changes: layerChanges.slice(0, 10), // Primeras 10 capas para análisis
      averageHeight: layerCount > 1 ? 
        (layerChanges[layerChanges.length - 1]?.z - layerChanges[0]?.z) / (layerCount - 1) : 
        analysis.metadata.layerHeight || 0
    };
  }

  // Análisis de calidad
  async analyzeQuality(lines, analysis) {
    const issues = [];
    let retractionCount = 0;
    let fanCommands = 0;
    let rapidChanges = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) continue;

      // Detectar retracciones
      if (line.includes('E-')) {
        retractionCount++;
      }

      // Comandos de ventilador
      if (line.startsWith('M106') || line.startsWith('M107')) {
        fanCommands++;
      }

      // Cambios bruscos de velocidad
      if (line.includes('F')) {
        const currentSpeed = this.extractSpeed(line);
        const nextLine = lines[i + 1];
        if (nextLine) {
          const nextSpeed = this.extractSpeed(nextLine);
          if (currentSpeed && nextSpeed && Math.abs(currentSpeed - nextSpeed) > currentSpeed * 0.5) {
            rapidChanges++;
          }
        }
      }
    }

    // Evaluar problemas potenciales
    const totalLines = analysis.lineCount;
    
    if (retractionCount / totalLines > 0.1) {
      issues.push({
        type: 'high_retractions',
        severity: 'warning',
        message: `Alto número de retracciones: ${retractionCount}`,
        suggestion: 'Revisar configuraciones de retracción'
      });
    }

    if (rapidChanges > totalLines * 0.05) {
      issues.push({
        type: 'speed_changes',
        severity: 'info',
        message: `Muchos cambios de velocidad: ${rapidChanges}`,
        suggestion: 'Considerar suavizado de velocidades'
      });
    }

    analysis.quality = {
      score: this.calculateQualityScore(analysis),
      retractionCount,
      fanCommands,
      rapidChanges,
      issues
    };

    analysis.issues.push(...issues);
  }

  // Estimación de tiempo
  async estimatePrintTime(analysis) {
    const { movements, temperatures } = analysis;
    
    if (!movements.totalDistance) return;

    // Tiempo base por distancia y velocidad promedio
    const avgSpeed = parseFloat(movements.speeds.average) || 3000; // mm/min
    const totalDistance = parseFloat(movements.totalDistance);
    
    const movementTime = (totalDistance / avgSpeed) * 60; // segundos
    
    // Tiempo de calentamiento
    const heatingTime = (temperatures.hotend.changes + temperatures.bed.changes) * 30; // 30s promedio
    
    // Tiempo de enfriamiento de capas
    const layerCoolingTime = analysis.layers?.count * 5 || 0; // 5s por capa
    
    const totalEstimate = movementTime + heatingTime + layerCoolingTime;
    
    analysis.timing = {
      ...analysis.timing,
      estimatedSeconds: Math.round(totalEstimate),
      estimatedMinutes: Math.round(totalEstimate / 60),
      estimatedHours: (totalEstimate / 3600).toFixed(1),
      breakdown: {
        movement: Math.round(movementTime),
        heating: heatingTime,
        cooling: layerCoolingTime
      }
    };
  }

  // Generar sugerencias de optimización
  async generateOptimizationSuggestions(analysis) {
    const suggestions = [];
    
    // Análisis de velocidades
    if (analysis.movements.speeds.unique > 10) {
      suggestions.push({
        type: 'performance',
        priority: 'medium',
        title: 'Muchas velocidades diferentes',
        description: 'Reducir la variedad de velocidades puede mejorar la calidad',
        impact: 'Mejora la consistencia de impresión'
      });
    }

    // Análisis de viajes
    const travelPercentage = parseFloat(analysis.movements.travelPercentage);
    if (travelPercentage > 15) {
      suggestions.push({
        type: 'efficiency',
        priority: 'high',
        title: 'Alto porcentaje de movimientos de viaje',
        description: `${travelPercentage}% son movimientos sin extrusión`,
        impact: 'Optimizar el orden de impresión puede reducir el tiempo'
      });
    }

    // Análisis térmico
    if (analysis.temperatures.hotend.changes > analysis.layers.count * 0.5) {
      suggestions.push({
        type: 'thermal',
        priority: 'medium',
        title: 'Muchos cambios de temperatura',
        description: 'Considerar estabilizar las temperaturas',
        impact: 'Reduce el tiempo de espera y mejora la consistencia'
      });
    }

    analysis.suggestions = suggestions;
  }

  // Generar resumen
  generateSummary(analysis) {
    analysis.summary = {
      complexity: this.calculateComplexity(analysis),
      estimatedTime: analysis.timing.estimatedHours || 'No estimado',
      layerCount: analysis.layers?.count || 0,
      materialUsage: this.calculateMaterialUsage(analysis),
      qualityScore: analysis.quality?.score || 0,
      issueCount: analysis.issues.length,
      suggestionCount: analysis.suggestions.length,
      optimizationPotential: this.calculateOptimizationPotential(analysis)
    };
  }

  // Métodos auxiliares
  generateCacheKey(gcode) {
    // Simple hash del contenido para caché
    let hash = 0;
    for (let i = 0; i < gcode.length; i++) {
      const char = gcode.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  calculateDistance3D(pos1, pos2) {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }

  extractSpeed(line) {
    const match = line.match(/F(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  calculateQualityScore(analysis) {
    let score = 100;
    
    // Penalizar por problemas
    score -= analysis.issues.length * 10;
    
    // Penalizar por exceso de retracciones
    const retractionRatio = analysis.quality?.retractionCount / analysis.lineCount || 0;
    if (retractionRatio > 0.1) score -= 20;
    
    // Penalizar por muchas velocidades diferentes
    if (analysis.movements.speeds.unique > 15) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  calculateComplexity(analysis) {
    let complexity = 0;
    
    complexity += Math.min(analysis.lineCount / 1000, 50); // Máximo 50 por líneas
    complexity += Math.min(analysis.layers?.count || 0, 30); // Máximo 30 por capas
    complexity += Math.min(analysis.movements.speeds.unique, 20); // Máximo 20 por velocidades
    
    if (complexity < 30) return 'Baja';
    if (complexity < 70) return 'Media';
    return 'Alta';
  }

  calculateMaterialUsage(analysis) {
    const extrusionDistance = parseFloat(analysis.movements?.extrusionDistance || 0);
    // Estimación básica - habría que mejorar con más datos del filamento
    const volumeMM3 = extrusionDistance * Math.PI * Math.pow(0.4, 2); // Asumiendo 0.4mm de diámetro
    const gramsEstimate = (volumeMM3 * 1.25) / 1000; // Densidad típica PLA 1.25g/cm³
    
    return {
      extrusionDistance: extrusionDistance.toFixed(2) + 'mm',
      volumeEstimate: volumeMM3.toFixed(2) + 'mm³',
      weightEstimate: gramsEstimate.toFixed(1) + 'g'
    };
  }

  calculateOptimizationPotential(analysis) {
    const issues = analysis.issues.length;
    const suggestions = analysis.suggestions.length;
    
    const potential = (issues * 10) + (suggestions * 5);
    
    if (potential < 10) return 'Bajo';
    if (potential < 30) return 'Medio';
    return 'Alto';
  }

  updateStats(analysis) {
    this.stats.filesAnalyzed++;
    this.stats.totalLines += analysis.lineCount;
    this.stats.estimatedTime += analysis.timing?.estimatedSeconds || 0;
    this.stats.materialUsed += parseFloat(analysis.movements?.extrusionDistance || 0);
  }

  // API pública
  getCurrentAnalysis() {
    return this.currentAnalysis;
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.analysisCache.size
    };
  }

  clearCache() {
    this.analysisCache.clear();
    console.log('🗑️ Caché de análisis limpiado');
  }

  exportAnalysis(analysis = this.currentAnalysis) {
    if (!analysis) return null;
    
    return {
      ...analysis,
      exportedAt: Date.now(),
      version: this.version
    };
  }
}
