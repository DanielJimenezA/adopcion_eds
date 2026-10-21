# Prompt avanzado — Tablero SINBA–EDS v3

Actúa como arquitecto de datos, desarrollador Python y especialista en visualización institucional. Actualiza un tablero estático desplegable en GitHub Pages que compara SINBA 2025 y 2026 contra EDS 2026. Conserva la lectura de CSV, Excel y Parquet y las rutas de `config/sources.json`.

## Reglas del universo y calendario

1. Trabaja del 1 de enero a la última semana ISO completa de 2026. Alinea 2025 y 2026 por semana ISO, sin incluir semanas incompletas.
2. Define un universo fijo de CLUES compartidas entre SINBA 2026 y EDS 2026 **por área**: consulta externa, cirugías y hospitalizaciones. Normaliza CLUES y permite filtros por entidad (prefijo de dos caracteres) y CLUES individual.
3. Mantén auditoría de fechas inválidas, CLUES ausentes, archivos con año incorrecto, filas fuera de periodo y unidades excluidas del cruce. No sumes exclusiones solapadas como si fueran independientes.

## Escenarios y presentación

4. Procesa y conserva los escenarios simples de consulta externa (`ce_2025` y `ce_2026`) en los JSON, pero **no** los muestres en selector, gráficas ni exportaciones.
5. Conserva los otros ocho escenarios existentes y añade uno nuevo con **tres líneas**: SINBA 2025 (CE + planificación familiar + salud mental + salud bucal), SINBA 2026 (los mismos cuatro módulos) y EDS MoCE 2026. Usa la misma cohorte y filtros para las tres series.
6. Muestra indicadores correctamente denominados: para SINBA 2026 vs EDS 2026, `Proporción EDS en registros 2026 = EDS/(SINBA 2026 + EDS)`; para SINBA 2025 vs EDS 2026, `Relación EDS 2026 / SINBA 2025`, nunca porcentaje de adopción. En el gráfico triple, calcula la proporción usando exclusivamente SINBA 2026 y EDS 2026.
7. Los filtros por entidad y CLUES deben afectar series, KPI, CSV, PPTX, PDF y la auditoría. Los registros sin CLUES deben quedar en la auditoría global como no atribuibles a una entidad, nunca imputarse como cero en el filtrado.

## Informes y diseño

8. Usa `plantilla.pptx`: diapositiva 1 para portada, diapositiva 2 para todas las páginas de contenido. Genera PPTX y PDF institucionales, sin la antigua diapositiva final de auditoría. Conserva título, periodo, filtros, leyendas y notas sobre conteos no deduplicados.
9. Mejora la interfaz con Noto Sans, colores institucionales sobrios, gráficos de líneas legibles, KPI con etiquetas inequívocas y advertencias cuando no hay CLUES coincidentes.
10. Verifica sintaxis JS/Python, genera JSON con pruebas sintéticas, compara sumas filtradas contra las bases y documenta limitaciones y privacidad antes de publicar datos por CLUES.
