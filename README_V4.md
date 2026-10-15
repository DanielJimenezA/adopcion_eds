# Ejecución v4.0

1. Conservar las rutas locales de `config/sources.json`.
2. Ejecutar `python scripts/build_data.py --config config/sources.json --as-of 2026-10-09`.
3. Opcional: agregar `config/unidades_catalogo.csv` con encabezados `clues,nombre_unidad`.
4. Para usar el mapa sin conexión, guardar un GeoJSON válido de las **32 entidades** en `assets/mexico_estados.geojson`, con el nombre de cada entidad en la propiedad `name`, `NOMGEO`, `nom_ent`, `NOM_ENT`, `estado` o `NAME_1`. Si falta, el navegador intenta obtener `https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json`; este recurso no pudo verificarse en el entorno de generación.
5. Iniciar `python -m http.server 8085` y abrir `http://localhost:8085`.
6. Validar conteos y relaciones con las fuentes reales antes de publicación institucional.

**Importante:** la comparación por mes puede incorporar un último mes parcial; las cifras KPI y territoriales se basan en semanas completas.

Las CLUES HRAES continúan separadas de las generales. Los indicadores expresan **relaciones entre volúmenes de filas**, no tasas de adopción de unidades.
