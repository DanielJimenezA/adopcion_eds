# v4.4 — Presentación territorial

- Se oculta del HTML la sección «Calidad y cobertura de los datos del grupo seleccionado»; los JSON y la lógica de auditoría se conservan para uso futuro.
- Mapa ECharts: `aspectScale: 1` para evitar el achatamiento vertical por la proporción por defecto. Se mantienen `layoutCenter` y `layoutSize`.
- Leyenda de cuatro intervalos: 0–<25, 25–<50, 50–<75 y >=75. El cuarto incluye >100% para no ocultar valores superiores a la referencia histórica. Las etiquetas visibles son redondeadas para lectura ejecutiva.
- Exportaciones PowerPoint/PDF: imágenes insertadas con ajuste proporcional, sin estirar los PNG al rectángulo disponible.
- Los JSON de datos no se modifican.
