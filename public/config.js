// Configuración de Firebase - Server3D
// NOTA: En producción, estas credenciales deben ser protegidas

// Configuración deshabilitada por defecto para evitar errores
// Los usuarios deben configurar sus propias credenciales de Firebase
window.firebaseConfig = {
  // Descomenta y configura con tus credenciales de Firebase
  // apiKey: "your-api-key",
  // authDomain: "your-project.firebaseapp.com",
  // databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  // projectId: "your-project",
  // storageBucket: "your-project.appspot.com",
  // messagingSenderId: "your-sender-id",
  // appId: "your-app-id"
  
  // Configuración vacía para evitar errores
  disabled: true
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
