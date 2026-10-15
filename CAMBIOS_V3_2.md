# Versión 3.2

- Encabezado institucional: logotipo, título, descripción y fecha de actualización.
- Paleta institucional con verdes, guinda, dorado y tonos pastel.
- KPI separados SINBA 2025, SINBA 2026 y EDS 2026; calculados con el universo filtrado.
- Vista mensual con agregación por mes calendario real desde el procesador (`detalle_mensual.json`).
- Exportaciones PPTX/PDF: gráficos reducidos y reposicionados en el área segura de la segunda diapositiva.
- Se conserva la plantilla institucional de dos fondos y se omite la diapositiva final.

## Precisión metodológica
La vista mensual se corta a la última semana completa de 2026; el mes final de 2026 puede ser parcial. La comparación mensual de 2025 en el mes final podría incluir días adicionales si el archivo 2025 los contiene: no interpretarlo como una comparación de días idénticos. Para comparación estricta día a día, ampliar el procesador con corte de día equivalente de 2025.

## Ejecutar
`python scripts/build_data.py --config config/sources.json --as-of 2026-10-09`

`python -m http.server 8085`

Conservar `config/sources.json` personalizado; el archivo del ZIP es una plantilla.
