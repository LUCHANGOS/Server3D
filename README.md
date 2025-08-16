# Server3D - Control Web de Impresoras 3D

Una aplicación web PWA para controlar impresoras 3D vía USB, Bluetooth, OctoPrint y Moonraker con Firebase Realtime Database y "IA" local para comandos en español.

## 🌟 Características

- **Conexiones múltiples**: USB (Web Serial), Bluetooth (Web Bluetooth), OctoPrint y Moonraker
- **IA local**: Interpreta comandos en español natural
- **PWA**: Funciona offline, instalable
- **Firebase RTDB**: Sincronización en tiempo real
- **G-code Streaming**: Cola inteligente con control de flujo
- **Interfaz moderna**: Diseño responsive con tabs

## 🚀 Acceso Directo

**URL de la aplicación**: https://luchangos.github.io/Server3D/

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
