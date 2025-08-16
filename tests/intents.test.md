# Tests de IA Local (Intents) - Server3D

## Comandos de Temperatura

### Hotend
- ✅ "poner hotend a 200 grados" → M104 S200
- ✅ "calentar boquilla a 180" → M104 S180
- ✅ "temperatura extrusor 220" → M104 S220
- ✅ "hotend 190" → M104 S190
- ❌ "hotend 500" → Error: temperatura muy alta

### Cama
- ✅ "poner cama a 60 grados" → M140 S60
- ✅ "calentar bed a 50" → M140 S50
- ✅ "temperatura cama 70" → M140 S70
- ❌ "cama 150" → Error: temperatura muy alta

## Comandos de Movimiento

### Home
- ✅ "home todo" → G28
- ✅ "home all" → G28
- ✅ "inicio todos los ejes" → G28
- ✅ "home eje X" → G28 X
- ✅ "casa Y" → G28 Y

### Movimiento Relativo
- ✅ "mover eje X 10mm" → G91\nG1 X10\nG90
- ✅ "mover Y -5 milímetros" → G91\nG1 Y-5\nG90
- ✅ "mueve Z 0.2" → G91\nG1 Z0.2\nG90
- ❌ "mover X 2000mm" → Error: distancia muy grande

## Control de Impresión

### Iniciar
- ✅ "iniciar impresión" → Comando de inicio
- ✅ "comenzar print" → Comando de inicio
- ✅ "imprimir benchy.gcode" → Comando con archivo

### Control
- ✅ "pausar impresión" → M25
- ✅ "reanudar" → M24
- ✅ "detener todo" → M25\nM104 S0\nM140 S0\nM107
- ✅ "emergencia" → Parada de emergencia

## Ventilador y Velocidad

### Ventilador
- ✅ "ventilador 100%" → M106 S255
- ✅ "fan 50 por ciento" → M106 S127
- ✅ "ventilador 0" → M107

### Velocidad de Impresión
- ✅ "velocidad 120%" → M220 S120
- ✅ "feedrate 80 por ciento" → M220 S80
- ❌ "velocidad 600%" → Error: velocidad inválida

## G-code Directo

- ✅ "M105" → M105
- ✅ "G28 X Y" → G28 X Y
- ✅ "m114" → M114
- ❌ "M999" → Error: comando no permitido

## Consultas de Estado

- ✅ "temperatura" → M105
- ✅ "posición" → M105 (consulta estado)
- ✅ "estado" → M105

## Casos Edge

### Comandos Vacíos
- ❌ "" → Error: comando vacío
- ❌ "   " → Error: comando vacío

### Comandos No Reconocidos
- ❌ "hacer café" → Sugerencia: comando similar
- ❌ "xyz abc" → Error con sugerencia

### Validaciones de Seguridad
- ❌ Temperaturas > límites → Error
- ❌ Movimientos > 1000mm → Error  
- ❌ Velocidades < 1% o > 500% → Error

## Sugerencias

El sistema debe sugerir comandos similares cuando no reconoce la entrada:
- "pone hotend 200" → "¿Quisiste decir 'poner hotend a 200 grados'?"
