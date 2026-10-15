# Versión 3.5 — Panel ejecutivo multigráfico

- El selector de escenario desaparece. Permanecen los filtros por grupo (General/HRAES), área, entidad, CLUES, vista y semana.
- Gráfico principal de tres líneas por área: SINBA 2025, SINBA 2026 y EDS 2026. Para cirugías utiliza la suma de las dos fuentes de procedimientos; para hospitalizaciones, egresos.
- Matriz de dos columnas con los escenarios secundarios: dos de consulta externa (integrales), cuatro de cirugías y dos de hospitalizaciones. Los escenarios CE simples continúan procesándose y no se muestran.
- Los gráficos comparten filtros, colores por año/sistema y auditoría.
- Los informes PDF/PPTX incluyen portada, gráfico integral en página propia y dos escenarios secundarios por página, sin diapositiva final.
- Requiere los mismos JSON de la versión 3.4 y conserva la configuración de fuentes.

## Advertencias metodológicas

- La suma de procedimientos quirúrgicos y procedimientos dentro de quirófano contabiliza filas, no necesariamente eventos clínicos distintos. Revisar solapamientos.
- La vista mensual muestra meses calendario: el último mes puede estar incompleto y la comparación con 2025 no representa necesariamente el mismo número de días. No interpretar una caída de ese mes como descenso de productividad.
- El universo común de CLUES se determina por área y se filtra después por grupo HRAES/general.
- La auditoría por CLUES no puede asignar filas sin CLUES a una entidad.

## Pruebas

`python -m pytest tests/test_build.py -q`

Verificar en navegador los gráficos y las exportaciones con datos reales antes de difusión institucional.
