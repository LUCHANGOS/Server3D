// Configuración de Firebase - EJEMPLO
// Copia este archivo como config.js y reemplaza con tu configuración real

window.firebaseConfig = {
  apiKey: "tu-api-key-aqui",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
  projectId: "tu-proyecto-id",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
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
  debug: false
};
