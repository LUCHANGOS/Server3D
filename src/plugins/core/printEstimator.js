/**
 * Print Estimator Plugin - Server3D
 * Estima tiempo de impresión y consume de material
 */

export class PrintEstimatorPlugin {
    constructor() {
        this.id = 'printEstimator';
        this.name = 'Estimador de Impresión';
        this.version = '1.0.0';
        this.description = 'Estima tiempo de impresión y consumo de material';
        this.author = 'Server3D';
        this.enabled = true;
        
        // Estado del plugin
        this.currentEstimation = null;
        this.isAnalyzing = false;
    }
    
    /**
     * Inicializa el plugin
     */
    async activate(context) {
        this.context = context;
        console.log(`✅ ${this.name} activado`);
        
        // Suscribirse a eventos
        this.context.eventBus?.on('gcode:loaded', this.handleGcodeLoaded.bind(this));
        this.context.eventBus?.on('print:started', this.handlePrintStarted.bind(this));
        
        return true;
    }
    
    /**
     * Desactiva el plugin
     */
    async deactivate() {
        // Limpiar suscripciones
        this.context.eventBus?.off('gcode:loaded', this.handleGcodeLoaded.bind(this));
        this.context.eventBus?.off('print:started', this.handlePrintStarted.bind(this));
        
        console.log(`❌ ${this.name} desactivado`);
        return true;
    }
    
    /**
     * Maneja cuando se carga un archivo G-code
     */
    async handleGcodeLoaded(event) {
        const { gcode, filename } = event.data;
        await this.estimatePrint(gcode, filename);
    }
    
    /**
     * Maneja cuando inicia una impresión
     */
    handlePrintStarted(event) {
        if (this.currentEstimation) {
            console.log(`📊 Impresión iniciada - Tiempo estimado: ${this.formatTime(this.currentEstimation.timeMinutes)}`);
        }
    }
    
    /**
     * Estima tiempo y material de impresión
     */
    async estimatePrint(gcode, filename = 'unknown') {
        try {
            this.isAnalyzing = true;
            
            const lines = gcode.split('\n');
            let estimation = {
                filename: filename,
                totalLines: lines.length,
                printingMoves: 0,
                extrusionMoves: 0,
                layerCount: 0,
                timeMinutes: 0,
                filamentLength: 0,
                filamentWeight: 0,
                boundingBox: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 },
                estimatedAt: new Date()
            };
            
            let currentPosition = { x: 0, y: 0, z: 0, e: 0 };
            let lastZ = -1;
            let totalDistance = 0;
            let totalExtruded = 0;
            let feedRate = 1500; // mm/min por defecto
            
            // Análisis línea por línea
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line || line.startsWith(';')) continue;
                
                // Detectar movimientos
                if (line.startsWith('G0') || line.startsWith('G1')) {
                    const move = this.parseGcodeMove(line);
                    
                    if (move.x !== undefined) currentPosition.x = move.x;
                    if (move.y !== undefined) currentPosition.y = move.y;
                    if (move.z !== undefined) {
                        currentPosition.z = move.z;
                        if (move.z > lastZ) {
                            estimation.layerCount++;
                            lastZ = move.z;
                        }
                    }
                    
                    if (move.f !== undefined) feedRate = move.f;
                    
                    // Calcular distancia del movimiento
                    const distance = Math.sqrt(
                        Math.pow(move.x - currentPosition.x, 2) +
                        Math.pow(move.y - currentPosition.y, 2) +
                        Math.pow(move.z - currentPosition.z, 2)
                    );
                    
                    if (move.e !== undefined) {
                        estimation.extrusionMoves++;
                        totalExtruded += Math.abs(move.e - currentPosition.e);
                        currentPosition.e = move.e;
                    }
                    
                    if (distance > 0) {
                        estimation.printingMoves++;
                        totalDistance += distance;
                        estimation.timeMinutes += (distance / feedRate) * 60;
                    }
                    
                    // Actualizar bounding box
                    this.updateBoundingBox(estimation.boundingBox, currentPosition);
                }
                
                // Detectar comandos de temperatura (añadir tiempo de calentamiento)
                if (line.startsWith('M104') || line.startsWith('M109') || line.startsWith('M140') || line.startsWith('M190')) {
                    estimation.timeMinutes += 3; // 3 minutos aproximados para calentamiento
                }
            }
            
            // Cálculos finales
            estimation.filamentLength = totalExtruded / 1000; // en metros
            estimation.filamentWeight = estimation.filamentLength * 2.85; // aproximado para PLA 1.75mm
            estimation.timeMinutes = Math.ceil(estimation.timeMinutes);
            
            this.currentEstimation = estimation;
            this.isAnalyzing = false;
            
            // Emitir evento de estimación completada
            this.context.eventBus?.emit('print:estimated', { estimation });
            
            console.log(`📊 Estimación completada:`, estimation);
            return estimation;
            
        } catch (error) {
            console.error('❌ Error en estimación de impresión:', error);
            this.isAnalyzing = false;
            return null;
        }
    }
    
    /**
     * Parsea un comando de movimiento G-code
     */
    parseGcodeMove(line) {
        const move = {};
        const regex = /([XYZEF])([-+]?\d*\.?\d+)/g;
        let match;
        
        while ((match = regex.exec(line)) !== null) {
            const axis = match[1].toLowerCase();
            const value = parseFloat(match[2]);
            move[axis] = value;
        }
        
        return move;
    }
    
    /**
     * Actualiza el bounding box con la posición actual
     */
    updateBoundingBox(boundingBox, position) {
        boundingBox.minX = Math.min(boundingBox.minX, position.x);
        boundingBox.maxX = Math.max(boundingBox.maxX, position.x);
        boundingBox.minY = Math.min(boundingBox.minY, position.y);
        boundingBox.maxY = Math.max(boundingBox.maxY, position.y);
        boundingBox.minZ = Math.min(boundingBox.minZ, position.z);
        boundingBox.maxZ = Math.max(boundingBox.maxZ, position.z);
    }
    
    /**
     * Formatea tiempo en formato legible
     */
    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    }
    
    /**
     * Obtiene la estimación actual
     */
    getCurrentEstimation() {
        return this.currentEstimation;
    }
    
    /**
     * Configuración del plugin
     */
    getConfig() {
        return {
            filamentDensity: 1.24, // g/cm³ para PLA
            filamentDiameter: 1.75, // mm
            defaultFeedRate: 1500, // mm/min
            heatingTime: 180 // segundos
        };
    }
    
    /**
     * Estadísticas del plugin
     */
    getStats() {
        return {
            isAnalyzing: this.isAnalyzing,
            lastEstimation: this.currentEstimation?.estimatedAt || null,
            estimationsCount: this.currentEstimation ? 1 : 0
        };
    }
}

// Exportar clase para uso del plugin manager
export default PrintEstimatorPlugin;
