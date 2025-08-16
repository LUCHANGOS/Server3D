// Configuración de Firebase - Server3D
// NOTA: En producción, estas credenciales deben ser protegidas

// Configuración de Firebase para Server3D
window.firebaseConfig = {
  apiKey: "AIzaSyBK6Sm3qFHQK-6wPrF3Ag9wFOcKVkPBx9M",
  authDomain: "server3d-ai.firebaseapp.com",
  databaseURL: "https://server3d-ai-default-rtdb.firebaseio.com",
  projectId: "server3d-ai",
  storageBucket: "server3d-ai.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
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
