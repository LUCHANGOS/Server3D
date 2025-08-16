// Configuración de Firebase - Server3D
// NOTA: En producción, estas credenciales deben ser protegidas

// Configuración de Firebase para Server3D
// Firebase temporalmente deshabilitado para evitar errores
// Para habilitar: obtén tus credenciales reales de Firebase Console
window.firebaseConfig = {
  // Configuración deshabilitada - funcionando en modo local
  disabled: true,
  
  // Para habilitar Firebase, descomenta y configura:
  // apiKey: "tu-api-key-real",
  // authDomain: "tu-proyecto.firebaseapp.com",
  // databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
  // projectId: "tu-proyecto",
  // storageBucket: "tu-proyecto.appspot.com",
  // messagingSenderId: "tu-sender-id",
  // appId: "tu-app-id"
};

// Configuración de la aplicación
window.appConfig = {
  // Límites de seguridad
  maxHotendTemp: 300,
  maxBedTemp: 120,
  maxFanSpeed: 100,
  
  // Timeouts (milisegundos)
  connectionTimeout: 10000,
  commandTimeout: 5000,
  tempQueryInterval: 2000,
  
  // G-code streaming
  maxFileSize: 1024 * 1024, // 1MB
  streamBufferSize: 10,
  
  // Debug mode
  debug: true
};
