# Server3D v2.0 - Control Avanzado de Impresoras 3D 🚀

Una aplicación web PWA de próxima generación para el control profesional de impresoras 3D con sistema de plugins extensible, IA local avanzada, monitoreo inteligente y analytics en tiempo real.

## 🌟 Características Principales

### 🔌 Sistema de Plugins Extensible
- **Arquitectura modular**: Sistema de plugins con hooks y eventos
- **Plugins del core**: Monitor de temperatura, analizador de G-code, gestor de seguridad
- **API para desarrolladores**: Crea tus propios plugins personalizados
- **Configuración dinámica**: Activa/desactiva plugins según necesidades

### 🧪 Inteligencia Artificial Mejorada
- **IA local avanzada**: Interpreta comandos en español natural con mayor precisión
- **Análisis predictivo**: Detecta problemas antes de que ocurran
- **Sugerencias inteligentes**: Optimizaciones automáticas basadas en patrones
- **Aprendizaje de uso**: Se adapta a tu flujo de trabajo

### 🛡️ Sistema de Seguridad Avanzado
- **Perfiles de seguridad**: Conservador, estándar y avanzado
- **Protección térmica**: Detección de thermal runaway y alertas inteligentes
- **Watchdog system**: Monitoreo continuo del sistema
- **Paradas de emergencia**: Múltiples métodos de activación
- **Validación de comandos**: Filtrado de comandos peligrosos

### 📊 Analytics y Estadísticas
- **Dashboard completo**: Visualización en tiempo real del estado del sistema
- **Historial de impresiones**: Seguimiento detallado con tags y notas
- **Análisis de G-code**: Predicciones de tiempo, material y calidad
- **Métricas de rendimiento**: Estadísticas de éxito, tiempo total, material usado
- **Exportación de datos**: Respaldos y análisis externos

### 🌡️ Monitoreo Inteligente
- **Temperatura predictiva**: Alertas antes de problemas críticos
- **Historial térmico**: Gráficos y tendencias de temperatura
- **Detección de anomalías**: Fluctuaciones y desviaciones inusuales
- **Notificaciones**: Alertas de escritorio y sonoras

### 🔌 Conexiones Múltiples
- **USB Serial**: Conexión directa vía Web Serial API
- **Bluetooth LE**: Soporte para UART/NUS sobre BLE
- **OctoPrint**: Integración completa REST + WebSocket
- **Moonraker**: Control nativo de Klipper
- **Auto-detección**: Reconocimiento automático de dispositivos

### 🎨 Interfaz de Nueva Generación
- **Diseño moderno**: UI renovada con Material Design 3.0
- **Responsive**: Optimizada para desktop, tablet y móvil
- **Modo oscuro**: Soporte completo para temas
- **Accesibilidad**: Cumple con estándares WCAG 2.1
- **PWA avanzada**: Instalación nativa en cualquier plataforma

## 🚀 Acceso Directo

**Server3D v2.0**: [https://luchangos.github.io/Server3D/](https://luchangos.github.io/Server3D/)

> ⚡ **Novedad**: Ahora con sistema de plugins, analytics avanzados y protección de seguridad mejorada

## 📋 Compatibilidad

### Web Serial (USB)
| Navegador | Windows | macOS | Linux | Android | iOS |
|-----------|---------|-------|-------|---------|-----|
| Chrome    | ✅      | ✅    | ✅    | ❌      | ❌  |
| Edge      | ✅      | ✅    | ✅    | ❌      | ❌  |
| Firefox   | ❌      | ❌    | ❌    | ❌      | ❌  |
| Safari    | ❌      | ❌    | ❌    | ❌      | ❌  |

### Web Bluetooth (BLE)
| Navegador | Windows | macOS | Linux | Android | iOS |
|-----------|---------|-------|-------|---------|-----|
| Chrome    | ✅      | ✅    | ✅    | ✅      | ❌  |
| Edge      | ✅      | ✅    | ✅    | ✅      | ❌  |
| Firefox   | ❌      | ❌    | ❌    | ❌      | ❌  |
| Safari    | ❌      | ❌    | ❌    | ❌      | ❌  |

**Nota importante**: BLE es diferente de Bluetooth clásico (SPP). Tu impresora debe soportar BLE UART/NUS.

## ⚙️ Configuración Inicial

### 1. Firebase Setup
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilita Realtime Database
3. Copia la configuración de tu proyecto
4. Duplica `public/config.example.js` como `public/config.js`
5. Pega tu configuración Firebase en `config.js`

### 2. Firebase Security Rules
Importa `firebase.rules.json` en Firebase Console > Realtime Database > Reglas:

```javascript
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### 3. CORS para APIs Remotas

#### OctoPrint
Añade en `~/.octoprint/config.yaml`:
```yaml
api:
  allow_cors: true
  cors_allow_origin: https://luchangos.github.io
```

#### Moonraker
Añade en `printer.cfg`:
```ini
[moonraker]
cors_domains:
  https://luchangos.github.io
```

## 🎮 Uso

### Conexiones
1. **USB**: Haz clic en "Conectar USB", selecciona puerto (115200 o 250000 baud)
2. **BLE**: Activa Bluetooth, haz clic en "Conectar BLE", selecciona dispositivo
3. **OctoPrint**: Introduce host:puerto y API key
4. **Moonraker**: Introduce host:puerto

### Comandos en Español
Ejemplos de comandos que puedes escribir:
- "Poner hotend a 200 grados"
- "Calentar cama a 60"
- "Home todas las ejes"
- "Mover eje X 10 milímetros"
- "Velocidad al 120 por ciento"
- "Pausar impresión"
- "Reanudar impresión"
- "Detener todo"
- "Iniciar impresión benchy.gcode"

### Carga de G-code
- Archivos pequeños (&lt;1MB) se procesan localmente
- Solo metadatos se guardan en Firebase (no el contenido del archivo)
- Streaming con control de flujo y manejo de errores

## 📊 Analytics y Monitoreo

### Pestaña Analytics
Server3D v2.0 incluye una pestaña dedicada de analytics con:

#### 📝 Dashboard de Sistema
- **Estado de plugins**: Monitoreo en tiempo real de todos los plugins
- **Métricas del sistema**: Tiempo activo, comandos enviados, memoria usada
- **Estado de seguridad**: Perfil activo, alertas y protecciones
- **Monitor térmico**: Historial de temperaturas y alertas críticas

#### 🖨️ Estadísticas de Impresión
- **Impresiones totales**: Contador de trabajos completados
- **Tasa de éxito**: Porcentaje de impresiones exitosas
- **Tiempo acumulado**: Horas totales de impresión
- **Material consumido**: Metros de filamento utilizados

#### 🔍 Análisis de G-code
- **Complejidad del archivo**: Evaluación automática
- **Tiempo estimado**: Predicción mejorada vs slicer
- **Calidad predictiva**: Score basado en parámetros
- **Sugerencias de optimización**: Mejoras automáticas
- **Detección de problemas**: Alertas preventivas

### Controles Disponibles
- **🔄 Actualizar**: Refresca todos los datos en tiempo real
- **💾 Exportar Datos**: Descarga historial en formato JSON
- **🗑️ Limpiar Historial**: Reset de datos almacenados
- **🐛 Info Debug**: Información técnica del sistema

## 🛡️ Seguridad Avanzada

### Perfiles de Seguridad

#### Conservador (Principiantes)
- Temperaturas limitadas: Hotend ≤250°C, Cama ≤80°C
- Velocidades reducidas: Máx 3000mm/min
- Filtrado estricto de comandos
- Volumen de construcción limitado

#### Estándar (Uso General)
- Temperaturas normales: Hotend ≤280°C, Cama ≤120°C
- Velocidades estándar: Máx 6000mm/min
- Filtrado moderado
- Protección térmica activa

#### Avanzado (Usuarios Experimentados)
- Sin límites de temperatura (hasta 300°C)
- Velocidades altas permitidas
- Mínimo filtrado
- Máxima flexibilidad

### Funciones de Emergencia
- **Ctrl+Shift+E**: Parada de emergencia inmediata
- **F1**: Limpiar estado de emergencia
- **Escape**: Parada de emergencia con conexión activa
- **Watchdog**: Detección de bloqueos del sistema

## 🔌 Desarrollo de Plugins

### API para Desarrolladores

```javascript
// Estructura básica de un plugin
import { BasePlugin } from './pluginManager.js';

export default class MiPlugin extends BasePlugin {
  constructor() {
    super('miPlugin', '1.0.0');
  }

  getMetadata() {
    return {
      name: 'Mi Plugin Personalizado',
      version: '1.0.0',
      description: 'Descripción del plugin',
      author: 'Tu Nombre',
      dependencies: []
    };
  }

  async activate(pluginManager) {
    await super.activate(pluginManager);
    
    // Registrar hooks
    this.addHook('before:command', this.onCommand.bind(this));
    this.addHook('temperature:update', this.onTemperature.bind(this));
  }

  async onCommand(command) {
    // Lógica personalizada
    console.log('Comando recibido:', command);
    return command;
  }

  async onTemperature(data) {
    // Monitoreo personalizado
    console.log('Temperatura:', data);
    return data;
  }
}
```

### Hooks Disponibles
- `before:connect` / `after:connect`
- `before:disconnect` / `after:disconnect`
- `before:command` / `after:command`
- `before:gcode:stream` / `after:gcode:stream`
- `temperature:update`
- `position:update`
- `print:status:change`
- `error:occurred`

### Registro de Plugins
```javascript
// Registrar plugin externo
server3d.registerExternalPlugin('miPlugin', MiPluginClass);
```

## 🔧 Desarrollo Local

```bash
# Clonar repositorio
git clone https://github.com/LUCHANGOS/Server3D.git
cd Server3D

# Configurar Firebase
cp public/config.example.js public/config.js
# Editar config.js con tu configuración

# Servir localmente (requiere HTTPS para Web APIs)
# Opción 1: Python
python -m http.server 8000 --directory public

# Opción 2: Node.js
npx serve public -s

# Opción 3: Live Server (VS Code extension)
```

**Importante**: Las APIs Web Serial y Bluetooth requieren HTTPS. En desarrollo local usa certificados auto-firmados o ngrok.

### Comandos de Debug
```javascript
// En la consola del navegador
server3d.debug()           // Información completa del sistema
server3d.help()            // Lista de comandos disponibles
server3d.getExtendedInfo() // Estado detallado
server3d.getAppStats()     // Estadísticas de la aplicación

// Plugins
pluginManager.listPlugins()    // Listar todos los plugins
pluginManager.getDebugInfo()   // Info de debug de plugins
```

## 📁 Estructura del Proyecto

```
Server3D/
├── README.md
├── LICENSE
├── firebase.rules.json
├── .github/workflows/gh-pages.yml
├── public/                    # Archivos servidos
│   ├── index.html
│   ├── styles.css
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── config.example.js
│   ├── config.js             # Tu configuración Firebase
│   └── assets/
│       └── icons/            # Íconos PWA
├── src/                      # Módulos JavaScript
│   ├── app.js               # Aplicación principal
│   ├── ui.js                # Interfaz de usuario
│   ├── firebase.js          # Cliente Firebase
│   ├── store.js             # Estado global
│   ├── intents.js           # IA local (NLP)
│   ├── gcodeStreamer.js     # Streaming G-code
│   ├── transports/
│   │   ├── serial.js        # Web Serial API
│   │   ├── bluetooth.js     # Web Bluetooth API
│   │   ├── octoprint.js     # OctoPrint REST+WS
│   │   └── moonraker.js     # Moonraker WebSocket
│   └── utils/
│       ├── gcode.js         # Parser G-code
│       └── validate.js      # Validaciones
└── tests/                   # Documentación de pruebas
    ├── intents.test.md
    └── streamer.test.md
```

## 🛡️ Seguridad

- Autenticación Firebase anónima por usuario
- Reglas de base de datos por UID
- Límites de temperatura configurables
- Validación de comandos G-code
- No se almacena contenido de archivos en la nube

## 🚀 Deployment

El proyecto se despliega automáticamente en GitHub Pages vía GitHub Actions:
- Push a `main` → Build → Deploy a `gh-pages`
- URL: https://luchangos.github.io/Server3D/

## 📝 Licencia

MIT License - ve [LICENSE](LICENSE) para detalles.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## ⚠️ Disclaimers

- **Riesgo de hardware**: Usa límites de temperatura apropiados
- **Conexiones inalámbricas**: Pueden tener latencia variable
- **APIs experimentales**: Web Serial/Bluetooth están en desarrollo
- **Solo para desarrollo**: No usar en producción sin pruebas exhaustivas
