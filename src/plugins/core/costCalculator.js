/**
 * Plugin Calculadora de Costos para Server3D
 * Calcula costos detallados de impresión incluyendo materiales, tiempo, impresora e IVA 19%
 */

class CostCalculatorPlugin {
    constructor() {
        this.name = 'costCalculator';
        this.version = '1.0.0';
        this.description = 'Calculadora avanzada de costos de impresión 3D con IVA 19%';
        this.author = 'Server3D Team';
        this.active = false;
        this.pluginManager = null;
        
        // Configuración predeterminada de costos
        this.costConfig = {
            // Materiales (precio por kg en COP)
            materials: {
                PLA: { price: 85000, density: 1.24, name: 'PLA' },
                ABS: { price: 90000, density: 1.04, name: 'ABS' },
                PETG: { price: 95000, density: 1.27, name: 'PETG' },
                TPU: { price: 120000, density: 1.20, name: 'TPU' },
                ASA: { price: 110000, density: 1.05, name: 'ASA' },
                WOOD: { price: 100000, density: 1.15, name: 'PLA Madera' },
                CARBON: { price: 150000, density: 1.30, name: 'Fibra de Carbono' },
                CUSTOM: { price: 100000, density: 1.24, name: 'Material Personalizado' }
            },
            
            // Costos de operación (por hora en COP)
            operation: {
                electricity: 450,        // Costo promedio por kWh en Colombia
                printerWear: 500,        // Desgaste de impresora por hora
                maintenance: 200,        // Mantenimiento por hora
                labor: 8000             // Costo de mano de obra por hora
            },
            
            // Configuración de impresoras
            printers: {
                ENDER3: { 
                    power: 200, 
                    name: 'Ender 3 Series',
                    hourlyRate: 2500 
                },
                CR10: { 
                    power: 220, 
                    name: 'CR-10 Series',
                    hourlyRate: 3000 
                },
                PRUSA: { 
                    power: 180, 
                    name: 'Prusa i3 MK3S+',
                    hourlyRate: 4000 
                },
                BAMBU: { 
                    power: 250, 
                    name: 'Bambu Lab X1C',
                    hourlyRate: 5000 
                },
                VORON: { 
                    power: 300, 
                    name: 'Voron 2.4',
                    hourlyRate: 6000 
                },
                CUSTOM: { 
                    power: 200, 
                    name: 'Impresora Personalizada',
                    hourlyRate: 3000 
                }
            },
            
            // Porcentajes adicionales
            tax: 19,                    // IVA Colombia
            profit: 25,                 // Margen de ganancia sugerido
            wastage: 5,                 // Desperdicio de material
            failureRate: 3              // Tasa de fallo estimada
        };
        
        // Historial de cálculos
        this.calculations = [];
        this.stats = {
            totalCalculations: 0,
            totalRevenue: 0,
            totalCosts: 0,
            totalProfit: 0,
            averageJobCost: 0
        };
    }
    
    async activate(pluginManager) {
        this.pluginManager = pluginManager;
        this.active = true;
        
        // Cargar configuración guardada
        await this.loadConfig();
        
        // Registrar hooks
        if (this.pluginManager) {
            this.pluginManager.registerHook('print_started', this.onPrintStarted.bind(this));
            this.pluginManager.registerHook('print_completed', this.onPrintCompleted.bind(this));
            this.pluginManager.registerHook('gcode_analyzed', this.onGcodeAnalyzed.bind(this));
        }
        
        console.log(`[${this.name}] Plugin activado - Calculadora de costos lista`);
        
        // Crear interfaz en la UI
        this.createUI();
        
        return true;
    }
    
    async deactivate() {
        this.active = false;
        
        // Guardar configuración
        await this.saveConfig();
        
        // Remover interfaz
        this.removeUI();
        
        console.log(`[${this.name}] Plugin desactivado`);
        return true;
    }
    
    // Cargar configuración desde localStorage
    async loadConfig() {
        try {
            const saved = localStorage.getItem('server3d_cost_config');
            if (saved) {
                const config = JSON.parse(saved);
                this.costConfig = { ...this.costConfig, ...config };
            }
            
            const savedCalcs = localStorage.getItem('server3d_cost_calculations');
            if (savedCalcs) {
                this.calculations = JSON.parse(savedCalcs);
            }
            
            const savedStats = localStorage.getItem('server3d_cost_stats');
            if (savedStats) {
                this.stats = JSON.parse(savedStats);
            }
        } catch (error) {
            console.warn(`[${this.name}] Error cargando configuración:`, error);
        }
    }
    
    // Guardar configuración en localStorage
    async saveConfig() {
        try {
            localStorage.setItem('server3d_cost_config', JSON.stringify(this.costConfig));
            localStorage.setItem('server3d_cost_calculations', JSON.stringify(this.calculations.slice(-100))); // Solo últimos 100
            localStorage.setItem('server3d_cost_stats', JSON.stringify(this.stats));
        } catch (error) {
            console.warn(`[${this.name}] Error guardando configuración:`, error);
        }
    }
    
    // Calcular costo completo de impresión
    calculatePrintCost(params) {
        const {
            material = 'PLA',
            weight = 0,              // peso en gramos
            printTime = 0,           // tiempo en minutos
            printer = 'ENDER3',
            includeLabor = false,
            customSettings = {}
        } = params;
        
        // Configuración efectiva (permitir overrides)
        const config = { ...this.costConfig, ...customSettings };
        
        const materialInfo = config.materials[material] || config.materials.PLA;
        const printerInfo = config.printers[printer] || config.printers.ENDER3;
        
        // Cálculo de costos base
        const calculations = {
            // Costo de material
            material: {
                weight: weight,
                pricePerKg: materialInfo.price,
                wastage: config.wastage,
                effectiveWeight: weight * (1 + config.wastage / 100),
                cost: (weight * (1 + config.wastage / 100) / 1000) * materialInfo.price
            },
            
            // Costo de electricidad
            electricity: {
                printTimeHours: printTime / 60,
                printerPowerKw: printerInfo.power / 1000,
                electricityRate: config.operation.electricity,
                cost: (printTime / 60) * (printerInfo.power / 1000) * config.operation.electricity
            },
            
            // Costo de impresora (desgaste)
            printer: {
                printTimeHours: printTime / 60,
                hourlyRate: printerInfo.hourlyRate,
                wearCost: config.operation.printerWear,
                maintenanceCost: config.operation.maintenance,
                cost: (printTime / 60) * (printerInfo.hourlyRate + config.operation.printerWear + config.operation.maintenance)
            },
            
            // Costo de mano de obra (opcional)
            labor: {
                printTimeHours: printTime / 60,
                hourlyRate: config.operation.labor,
                cost: includeLabor ? (printTime / 60) * config.operation.labor : 0
            }
        };
        
        // Totales antes de impuestos
        const subtotal = calculations.material.cost + 
                        calculations.electricity.cost + 
                        calculations.printer.cost + 
                        calculations.labor.cost;
        
        // Ajuste por tasa de fallo
        const failureAdjustment = subtotal * (config.failureRate / 100);
        
        // Subtotal con ajustes
        const adjustedSubtotal = subtotal + failureAdjustment;
        
        // IVA
        const tax = adjustedSubtotal * (config.tax / 100);
        
        // Total con IVA
        const totalWithTax = adjustedSubtotal + tax;
        
        // Precio sugerido con ganancia
        const suggestedProfit = totalWithTax * (config.profit / 100);
        const suggestedPrice = totalWithTax + suggestedProfit;
        
        const result = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            input: params,
            calculations,
            summary: {
                materialCost: calculations.material.cost,
                electricityCost: calculations.electricity.cost,
                printerCost: calculations.printer.cost,
                laborCost: calculations.labor.cost,
                subtotal,
                failureAdjustment,
                adjustedSubtotal,
                tax,
                taxRate: config.tax,
                totalWithTax,
                suggestedProfit,
                profitRate: config.profit,
                suggestedPrice,
                costPerGram: totalWithTax / (weight || 1),
                costPerHour: totalWithTax / (printTime / 60 || 1)
            },
            breakdown: {
                materialPercentage: (calculations.material.cost / adjustedSubtotal) * 100,
                electricityPercentage: (calculations.electricity.cost / adjustedSubtotal) * 100,
                printerPercentage: (calculations.printer.cost / adjustedSubtotal) * 100,
                laborPercentage: (calculations.labor.cost / adjustedSubtotal) * 100
            }
        };
        
        // Guardar cálculo en historial
        this.calculations.push(result);
        this.updateStats(result);
        
        return result;
    }
    
    // Actualizar estadísticas
    updateStats(calculation) {
        this.stats.totalCalculations++;
        this.stats.totalRevenue += calculation.summary.suggestedPrice;
        this.stats.totalCosts += calculation.summary.totalWithTax;
        this.stats.totalProfit += calculation.summary.suggestedProfit;
        this.stats.averageJobCost = this.stats.totalCosts / this.stats.totalCalculations;
        
        this.saveConfig();
    }
    
    // Calcular desde análisis de G-code
    calculateFromGcode(gcodeAnalysis) {
        if (!gcodeAnalysis) return null;
        
        const params = {
            weight: gcodeAnalysis.filamentWeight || 0,
            printTime: gcodeAnalysis.estimatedTime || 0,
            material: 'PLA', // Default, se puede cambiar en UI
            printer: 'ENDER3' // Default, se puede cambiar en UI
        };
        
        return this.calculatePrintCost(params);
    }
    
    // Crear interfaz de usuario
    createUI() {
        // Agregar pestaña de costos
        const tabsContainer = document.querySelector('.tabs');
        if (tabsContainer) {
            const costTab = document.createElement('button');
            costTab.className = 'tab-button';
            costTab.setAttribute('data-tab', 'costs');
            costTab.innerHTML = '<i class="fas fa-calculator"></i> Costos';
            tabsContainer.appendChild(costTab);
        }
        
        // Crear contenido de la pestaña
        const tabsContent = document.querySelector('.tab-content');
        if (tabsContent) {
            const costContent = document.createElement('div');
            costContent.className = 'tab-pane';
            costContent.id = 'costs';
            costContent.innerHTML = this.getCostCalculatorHTML();
            tabsContent.appendChild(costContent);
        }
        
        // Agregar event listeners
        this.attachEventListeners();
        
        // Actualizar display inicial
        this.updateCostDisplay();
    }
    
    // Remover interfaz
    removeUI() {
        const costTab = document.querySelector('[data-tab="costs"]');
        if (costTab) costTab.remove();
        
        const costContent = document.getElementById('costs');
        if (costContent) costContent.remove();
    }
    
    // HTML para la calculadora
    getCostCalculatorHTML() {
        return `
            <div class="cost-calculator">
                <div class="cost-header">
                    <div class="cost-header-content">
                        <h2>
                            <div class="icon">💰</div>
                            Sistema de Cotización Professional
                        </h2>
                        <div class="cost-actions">
                            <button id="refreshCosts" class="btn">
                                <i class="fas fa-sync"></i> Actualizar
                            </button>
                            <button id="exportCosts" class="btn">
                                <i class="fas fa-download"></i> Exportar
                            </button>
                            <button id="costSettings" class="btn">
                                <i class="fas fa-cog"></i> Configuración
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="cost-grid">
                    <div class="cost-section">
                        <h3>
                            <div class="cost-section-icon">📈</div>
                            Calculadora de Cotización
                        </h3>
                        <div class="cost-form">
                            <div class="form-row">
                                <label>📋 Tipo de Material</label>
                                <select id="materialSelect">
                                    ${Object.entries(this.costConfig.materials).map(([key, mat]) => 
                                        `<option value="${key}">${mat.name} - $${mat.price.toLocaleString('es-CO')}/kg</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="form-row">
                                <label>⚖️ Peso del Objeto (gramos)</label>
                                <input type="number" id="weightInput" min="0" step="0.1" placeholder="Ej: 25.5">
                            </div>
                            
                            <div class="form-row">
                                <label>⏱️ Tiempo de Impresión (minutos)</label>
                                <input type="number" id="timeInput" min="0" step="1" placeholder="Ej: 120">
                            </div>
                            
                            <div class="form-row">
                                <label>🖨️ Modelo de Impresora</label>
                                <select id="printerSelect">
                                    ${Object.entries(this.costConfig.printers).map(([key, printer]) => 
                                        `<option value="${key}">${printer.name}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="checkbox-row">
                                <input type="checkbox" id="includeLaborCheck">
                                <label for="includeLaborCheck">
                                    👷 Incluir costos de mano de obra especializada
                                </label>
                            </div>
                            
                            <div class="form-submit">
                                <button id="calculateBtn" class="btn-calculate">
                                    <i class="fas fa-calculator"></i> 
                                    Generar Cotización Professional
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="cost-section">
                        <h3>
                            <div class="cost-section-icon">📊</div>
                            Cotización Professional
                        </h3>
                        <div id="costResult" class="cost-result">
                            <div style="text-align: center; color: #64748b; font-style: italic; padding: 2rem;">
                                <div style="font-size: 3rem; margin-bottom: 1rem;">📋</div>
                                <p>Complete los campos del formulario y genere su cotización professional</p>
                                <small>Todos los cálculos incluyen IVA del 19% según normativa colombiana</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="cost-grid">
                    <div class="cost-section">
                        <h3>
                            <div class="cost-section-icon">📈</div>
                            Análisis de Rentabilidad
                        </h3>
                        <div id="costStats" class="stats-grid">
                            <!-- Estadísticas se cargan dinámicamente -->
                        </div>
                    </div>
                    
                    <div class="cost-section">
                        <h3>
                            <div class="cost-section-icon">📏</div>
                            Historial de Cotizaciones
                        </h3>
                        <div id="costHistory" class="cost-history">
                            <!-- Historial se carga dinámicamente -->
                        </div>
                    </div>
                </div>
                
                <div class="cost-section">
                    <h3>
                        <div class="cost-section-icon">⚙️</div>
                        Configuración de Tarifas
                    </h3>
                    <div id="priceConfig" class="price-config">
                        <!-- Configuración se carga dinámicamente -->
                    </div>
                </div>
            </div>
        `;
    }
    
    // Agregar event listeners
    attachEventListeners() {
        // Botón calcular
        const calculateBtn = document.getElementById('calculateBtn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.handleCalculateClick());
        }
        
        // Botón refrescar
        const refreshBtn = document.getElementById('refreshCosts');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.updateCostDisplay());
        }
        
        // Botón exportar
        const exportBtn = document.getElementById('exportCosts');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportCostData());
        }
        
        // Botón configuración
        const settingsBtn = document.getElementById('costSettings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettingsModal());
        }
    }
    
    // Manejar clic en calcular
    handleCalculateClick() {
        const material = document.getElementById('materialSelect')?.value || 'PLA';
        const weight = parseFloat(document.getElementById('weightInput')?.value) || 0;
        const time = parseFloat(document.getElementById('timeInput')?.value) || 0;
        const printer = document.getElementById('printerSelect')?.value || 'ENDER3';
        const includeLabor = document.getElementById('includeLaborCheck')?.checked || false;
        
        if (weight <= 0 || time <= 0) {
            alert('Por favor ingresa peso y tiempo válidos');
            return;
        }
        
        const result = this.calculatePrintCost({
            material,
            weight,
            printTime: time,
            printer,
            includeLabor
        });
        
        this.displayCostResult(result);
        this.updateCostDisplay();
        
        // Emitir evento
        if (this.pluginManager) {
            this.pluginManager.emitEvent('cost_calculated', result);
        }
    }
    
    // Mostrar resultado del cálculo
    displayCostResult(result) {
        const resultDiv = document.getElementById('costResult');
        if (!resultDiv) return;
        
        const { summary, breakdown } = result;
        
        resultDiv.innerHTML = `
            <div class="cost-summary">
                <div class="cost-total">
                    <h4>Precio Sugerido (con ganancia ${this.costConfig.profit}%)</h4>
                    <div class="price-display">$${summary.suggestedPrice.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                </div>
                
                <div class="cost-breakdown">
                    <h5>Desglose de Costos:</h5>
                    <div class="breakdown-item">
                        <span>Material (${breakdown.materialPercentage.toFixed(1)}%)</span>
                        <span>$${summary.materialCost.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Electricidad (${breakdown.electricityPercentage.toFixed(1)}%)</span>
                        <span>$${summary.electricityCost.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Impresora (${breakdown.printerPercentage.toFixed(1)}%)</span>
                        <span>$${summary.printerCost.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    </div>
                    ${summary.laborCost > 0 ? `
                    <div class="breakdown-item">
                        <span>Mano de obra (${breakdown.laborPercentage.toFixed(1)}%)</span>
                        <span>$${summary.laborCost.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    </div>
                    ` : ''}
                    <hr>
                    <div class="breakdown-item subtotal">
                        <span>Subtotal</span>
                        <span>$${summary.adjustedSubtotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div class="breakdown-item">
                        <span>IVA (${summary.taxRate}%)</span>
                        <span>$${summary.tax.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div class="breakdown-item total">
                        <span><strong>Total con IVA</strong></span>
                        <span><strong>$${summary.totalWithTax.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong></span>
                    </div>
                </div>
                
                <div class="cost-metrics">
                    <div class="metric">
                        <span>Costo por gramo:</span>
                        <span>$${summary.costPerGram.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div class="metric">
                        <span>Costo por hora:</span>
                        <span>$${summary.costPerHour.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Actualizar display completo
    updateCostDisplay() {
        this.updateStatsDisplay();
        this.updateHistoryDisplay();
        this.updateConfigDisplay();
    }
    
    // Actualizar estadísticas
    updateStatsDisplay() {
        const statsDiv = document.getElementById('costStats');
        if (!statsDiv) return;
        
        statsDiv.innerHTML = `
            <div class="stat-card">
                <h4>${this.stats.totalCalculations}</h4>
                <p>Cálculos Realizados</p>
            </div>
            <div class="stat-card">
                <h4>$${this.stats.totalRevenue.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</h4>
                <p>Ingresos Estimados</p>
            </div>
            <div class="stat-card">
                <h4>$${this.stats.totalProfit.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</h4>
                <p>Ganancia Estimada</p>
            </div>
            <div class="stat-card">
                <h4>$${this.stats.averageJobCost.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</h4>
                <p>Costo Promedio</p>
            </div>
        `;
    }
    
    // Actualizar historial
    updateHistoryDisplay() {
        const historyDiv = document.getElementById('costHistory');
        if (!historyDiv) return;
        
        const recent = this.calculations.slice(-10).reverse();
        
        if (recent.length === 0) {
            historyDiv.innerHTML = '<p class="text-muted">No hay cálculos recientes</p>';
            return;
        }
        
        historyDiv.innerHTML = recent.map(calc => `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-date">${new Date(calc.timestamp).toLocaleString('es-CO')}</span>
                    <span class="history-price">$${calc.summary.suggestedPrice.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                </div>
                <div class="history-details">
                    ${calc.input.weight}g ${calc.input.material} - ${Math.round(calc.input.printTime)}min
                </div>
            </div>
        `).join('');
    }
    
    // Actualizar configuración
    updateConfigDisplay() {
        const configDiv = document.getElementById('priceConfig');
        if (!configDiv) return;
        
        configDiv.innerHTML = `
            <div class="config-section">
                <h4>Porcentajes</h4>
                <div class="config-grid">
                    <div class="config-item">
                        <label>IVA:</label>
                        <span>${this.costConfig.tax}%</span>
                    </div>
                    <div class="config-item">
                        <label>Ganancia sugerida:</label>
                        <span>${this.costConfig.profit}%</span>
                    </div>
                    <div class="config-item">
                        <label>Desperdicio:</label>
                        <span>${this.costConfig.wastage}%</span>
                    </div>
                    <div class="config-item">
                        <label>Tasa de fallo:</label>
                        <span>${this.costConfig.failureRate}%</span>
                    </div>
                </div>
            </div>
            
            <div class="config-section">
                <h4>Costos Operación (por hora)</h4>
                <div class="config-grid">
                    <div class="config-item">
                        <label>Electricidad:</label>
                        <span>$${this.costConfig.operation.electricity}</span>
                    </div>
                    <div class="config-item">
                        <label>Desgaste:</label>
                        <span>$${this.costConfig.operation.printerWear}</span>
                    </div>
                    <div class="config-item">
                        <label>Mantenimiento:</label>
                        <span>$${this.costConfig.operation.maintenance}</span>
                    </div>
                    <div class="config-item">
                        <label>Mano de obra:</label>
                        <span>$${this.costConfig.operation.labor}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Exportar datos de costos
    exportCostData() {
        const data = {
            calculations: this.calculations,
            stats: this.stats,
            config: this.costConfig,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `server3d_costos_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // Mostrar modal de configuración
    showSettingsModal() {
        // Implementar modal de configuración avanzada
        alert('Modal de configuración - Por implementar en versión futura');
    }
    
    // Hook: cuando inicia una impresión
    async onPrintStarted(data) {
        if (data.gcodeAnalysis) {
            const costCalc = this.calculateFromGcode(data.gcodeAnalysis);
            if (costCalc) {
                console.log(`[${this.name}] Costo estimado de impresión: $${costCalc.summary.suggestedPrice.toLocaleString()}`);
            }
        }
    }
    
    // Hook: cuando termina una impresión
    async onPrintCompleted(data) {
        // Actualizar estadísticas si hay información de costo
        if (data.costCalculation) {
            this.updateStats(data.costCalculation);
        }
    }
    
    // Hook: cuando se analiza G-code
    async onGcodeAnalyzed(data) {
        // Auto-calcular costo si tenemos análisis de G-code
        if (data.analysis) {
            const costCalc = this.calculateFromGcode(data.analysis);
            if (costCalc && this.pluginManager) {
                this.pluginManager.emitEvent('auto_cost_calculated', {
                    analysis: data.analysis,
                    cost: costCalc
                });
            }
        }
    }
    
    // API pública del plugin
    getApi() {
        return {
            calculateCost: this.calculatePrintCost.bind(this),
            getStats: () => this.stats,
            getCalculations: () => this.calculations,
            getConfig: () => this.costConfig,
            updateConfig: (newConfig) => {
                this.costConfig = { ...this.costConfig, ...newConfig };
                this.saveConfig();
                this.updateCostDisplay();
            }
        };
    }
}

// Registrar plugin globalmente
if (typeof window !== 'undefined') {
    window.CostCalculatorPlugin = CostCalculatorPlugin;
}

export default CostCalculatorPlugin;
