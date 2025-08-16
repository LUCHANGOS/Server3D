# Tests de G-code Streamer - Server3D

## Casos de Uso Básicos

### Carga de Archivos
- ✅ Archivo .gcode válido → Parseado correctamente
- ✅ Archivo .g válido → Parseado correctamente  
- ✅ Archivo .txt con G-code → Parseado correctamente
- ❌ Archivo .zip → Error: tipo no válido
- ❌ Archivo > 1MB → Error: muy grande
- ❌ Archivo vacío → Error: sin contenido

### Validación de Contenido
- ✅ G-code válido → Sin errores
- ⚠️ Temperaturas altas → Warnings
- ❌ Comandos peligrosos → Errores
- ✅ Comentarios → Ignorados en streaming

## Streaming Control

### Iniciar Streaming
- ✅ Con archivo cargado + transporte → Inicia correctamente
- ❌ Sin archivo → Error: no file loaded
- ❌ Sin transporte → Error: no transport
- ✅ Con comandos válidos → Progreso actualizado

### Pausa/Reanuda
- ✅ Pausar durante streaming → Se detiene
- ✅ Reanudar después de pausa → Continúa desde donde paró
- ✅ Múltiples pausas/reanudas → Funciona correctamente

### Detener
- ✅ Detener durante streaming → Se cancela
- ✅ Limpiar progreso → Reset a 0%
- ✅ Estado después de stop → Idle

## Control de Flujo

### Respuestas de Impresora
- ✅ "ok" → Continúa con siguiente comando
- ⏸️ "busy" → Espera antes de continuar
- ❌ "error" → Pausa streaming
- ⏳ Sin respuesta → Timeout y retry

### Buffer Management
- ✅ Buffer de comandos → Máximo 10 comandos
- ✅ Espera respuesta → No overflow
- ✅ Procesamiento secuencial → Un comando a la vez

## Progreso y Estadísticas

### Tracking
- ✅ Línea actual → Actualizada en tiempo real
- ✅ Porcentaje → Calculado correctamente
- ✅ Tiempo transcurrido → Contador activo
- ✅ Estimación tiempo restante → Basado en progreso

### Metadatos
- ✅ Nombre archivo → Mostrado en UI
- ✅ Total líneas → Conteo correcto
- ✅ Comandos válidos → Filtrados comentarios
- ✅ Información adicional → Parseada de comentarios

## Manejo de Errores

### Errores de Transporte
- ❌ Conexión perdida → Pausa automática
- ❌ Timeout de comando → Retry o pausa
- ❌ Error de escritura → Log y pausa

### Errores de Archivo
- ❌ G-code corrupto → Error al parsear
- ❌ Comandos inválidos → Validación falla
- ❌ Archivo muy complejo → Warning de performance

### Recuperación
- ✅ Reconexión después error → Puede reanudar
- ✅ Reset después error → Estado limpio
- ✅ Logs de errores → Guardados en console

## Integración Firebase

### Metadatos
- ✅ Info archivo → Guardada en Firebase
- ✅ Progreso streaming → Sincronizado
- ✅ Errores → Logueados remotamente
- ✅ Estadísticas → Historial guardado

### Sincronización
- ✅ Estado en tiempo real → Múltiples dispositivos
- ✅ Comandos remotos → Pausa/stop remoto
- ✅ Backup progreso → Recuperación después desconexión

## Performance

### Archivos Grandes
- ✅ Parsing eficiente → < 1MB en < 2s
- ✅ Streaming sin lag → Buffer management
- ✅ UI responsive → Updates cada 100ms
- ✅ Memoria controlada → GC después streaming

### Optimizaciones
- ✅ Lazy loading → Solo comandos necesarios
- ✅ Batch updates → UI updates agrupados  
- ✅ Worker threads → Parser en background (futuro)

## Casos Edge

### Interrupciones
- ✅ Pestaña oculta → Continúa streaming
- ✅ Pérdida conexión internet → Local continúa
- ✅ Recarga página → Estado perdido (expected)
- ✅ Cierre inesperado → Parada segura

### Archivos Especiales
- ✅ Solo comentarios → No commands to stream
- ✅ Comandos muy largos → Truncados/validated
- ✅ Caracteres especiales → Encoding correcto
- ✅ Líneas vacías → Ignoradas

## Testing Manual

1. **Carga archivo benchy.gcode**
   - Verificar parsing correcto
   - Ver preview de primeras líneas
   - Comprobar metadatos extraídos

2. **Streaming simulado**
   - Iniciar sin impresora real
   - Verificar progreso visual
   - Probar pausa/reanuda/stop

3. **Error handling**
   - Desconectar durante streaming
   - Archivo corrupto
   - Comandos inválidos

4. **Performance**
   - Archivo grande (50K+ líneas)
   - Múltiples archivos en secuencia
   - Streaming durante horas
