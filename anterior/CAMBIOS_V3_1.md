# Versión 3.1 — Filtros y logotipo

- Se incorpora `assets/logo_imss_bienestar.png` en la cabecera.
- Los filtros de Cirugías y Hospitalizaciones se alimentan de las CLUES compartidas de cada área.
- Si un área tiene cero coincidencias, se muestran CLUES de ambas fuentes **solo para diagnóstico**, sin incluirlas en conteos o gráficos.
- `resumen_calidad.json` incorpora `catalogos_clues` con CLUES de SINBA y EDS para cada área. No publicar este catálogo sin autorización institucional.
- Se mantienen los diez escenarios originales y el escenario integral adicional.

## Instalación

Conservar `config/sources.json` local y reemplazar los demás archivos. Ejecutar `python scripts/build_data.py --config config/sources.json --as-of 2026-10-09`. Servir con `python -m http.server 8085` y forzar recarga del navegador.

## Diagnóstico

Si Cirugías u Hospitalizaciones no tiene coincidencias, revisar en `data/resumen_calidad.json` los valores de `auditoria_clues` y `catalogos_clues` por área. El cruce sigue exigiendo CLUES con registros válidos de ambos sistemas en 2026.
