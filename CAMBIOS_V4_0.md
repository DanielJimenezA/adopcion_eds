# Tablero de Adopción de EDS v4.0

- Un solo gráfico integral por área: SINBA 2025, SINBA 2026 y EDS 2026.
- Mapa estatal interactivo (requiere geometría GeoJSON local o conectividad al recurso público indicado en README).
- Barras por entidad con relaciones EDS 2026/SINBA 2025 y EDS 2026/SINBA 2026.
- Filtros globales aplicados a líneas, mapa, barras, auditoría y exportaciones.
- KPI de CLUES con registros EDS y relación histórica de volumen.
- Lectura ejecutiva específica del módulo y valor filtrado.
- Catálogo opcional de nombres de unidades en config/unidades_catalogo.csv.
- Se conserva el procesador y config/sources.json de v3.5.

## Limitaciones
- El mapa necesita GeoJSON estatal; si no existe el archivo local, intenta cargar una fuente pública en línea. No se incluyen geometrías verificadas en el ZIP.
- La auditoría por CLUES no puede atribuir geográficamente filas sin CLUES.
- La vista mensual procede de agregados por mes y el mes de corte puede ser parcial; no debe compararse directamente con meses completos.
- Las exportaciones requieren probarse con datos reales y la plantilla institucional.
