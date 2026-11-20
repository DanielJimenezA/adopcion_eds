# Versión 3.4 — Segmentación HRAES

Se incorpora filtro **Grupo de unidades** con dos grupos mutuamente excluyentes: Unidades generales y HRAES. El catálogo HRAES contiene siete CLUES. El universo de coincidencia SINBA–EDS continúa calculándose por área y año 2026. El grupo filtra después de ese cruce, antes de agregar series, indicadores, auditoría y exportaciones.

Los dos escenarios de consulta externa simple siguen ocultos. Se mantienen los demás escenarios, el gráfico integral, los filtros de entidad/CLUES y los informes.

**Nota:** esta implementación segmenta los JSON detallados ya generados. No modifica los Parquet ni los JSON globales, y no requiere reprocesar si ya existen `detalle_clues.json`, `detalle_mensual.json` y `auditoria_clues.json`. Las filas sin CLUES siguen sin ser atribuibles a un grupo. Los totales globales de `series_semanales.json` siguen siendo globales y no deben usarse como totales del grupo.
