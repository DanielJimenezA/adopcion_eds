# Tablero de Adopción SINBA–EDS v2

Tablero estático GitHub Pages con diez comparaciones, universo común de CLUES por área, semanas ISO completas, auditoría y exportación institucional PPTX/PDF desde navegador.

## Instalación (Windows / macOS)

```bash
python -m pip install -r requirements.txt
```

## Entradas

Configura `config/sources.json` con rutas a CSV, Excel `.xlsx` / `.xls` o Parquet; se pueden mezclar formatos. El patrón `insumos/sinba_ce_*.*` admite múltiples archivos y años. **No dupliques un mismo archivo en dos patrones.** Para Excel puedes añadir `"sheet": "Hoja1"` (por defecto, primera hoja); para CSV `"separator": ";"`, `"encoding": "cp1252"` si hace falta. Las columnas se buscan sin distinguir mayúsculas, minúsculas ni espacios externos.

Las diez fuentes configurables son `sinba_ce`, `sinba_pf`, `sinba_sm`, `sinba_sb`, `sinba_proc`, `sinba_proc_q`, `sinba_egr`, `eds_moce`, `eds_cir`, `eds_hosp`. Deben estar disponibles; para fuentes sin actividad crea un archivo válido solo con encabezados, no inventes registros.

## Procesar

```bash
python scripts/build_data.py --config config/sources.json --as-of 2026-10-08
```

Si omites `--as-of`, usa la fecha local del equipo. La última semana completa es la anterior a la semana en curso. Los registros de 2025 se alinean por número de semana ISO con 2026. La cohorte común se fija por área usando CLUES que tienen registros válidos en **ambos sistemas en 2026**. Los registros de 2025 se filtran usando esa misma cohorte. Las semanas sin registros se representan como cero. El intervalo de lectura empieza en 2025-01-01 y termina en el corte de 2026. El corte máximo permitido es 2026-12-27, última semana ISO completa que finaliza dentro de 2026.

Los JSON se generan en `data/`. No publicar archivos originales ni `insumos/`. `resumen_calidad.json` incluye faltantes, fechas inválidas, fuera de periodo y exclusiones por cohorte; las categorías de error pueden solaparse. El procesador cuenta filas y **no deduplica** procedimientos potencialmente presentes en más de un módulo.

## Vista local y GitHub Pages

```bash
python -m http.server 8000
```

Abre `http://localhost:8000`. Para publicar en GitHub Pages, sube HTML, CSS, JS y JSON agregados; mantén `insumos/` fuera del repositorio. Los botones PowerPoint y PDF generan **10 escenarios semanales** con el corte seleccionado. Los gráficos de PPTX se incrustan como imágenes de alta resolución (no son gráficos nativos editables). Las librerías se cargan por CDN, por lo que el navegador requiere conexión a internet. Para el diseño institucional definitivo, añade el logotipo institucional únicamente si tienes autorización para usarlo.

## Pruebas

`tests/test_build.py` genera fuentes sintéticas y valida la intersección de CLUES, el corte semanal, el lector CSV/Excel y las sumas. Los archivos `ce_test.csv` y `mocerecortado.csv` compartidos por el usuario son muestras y no están incluidos en el paquete ni se publican.


## Configuración SINBA por año (v2.1)

Cada módulo SINBA acepta `paths` con las claves `2025` y `2026`, con rutas completas o patrones.
Reemplaza las rutas que empiezan por `REEMPLAZAR_CON_RUTA_REAL_SINBA_2025` antes de ejecutar.
Las rutas de EDS conservan `path`. El lector anterior de `path` sigue disponible.
Se valida que la fecha de cada fila coincida con el año declarado; los registros discordantes
se excluyen y cuentan en `anio_no_corresponde_archivo`. No se infiere el año por el nombre.
Las rutas usan `/` para ser compatibles con JSON y Windows.


## Filtros por entidad y CLUES (v2.2)

El procesador genera `data/detalle_clues.json` adicional a los JSON existentes.
Se obtiene el estado a partir de los dos primeros caracteres de CLUES; comprobar que los prefijos corresponden al catálogo institucional.
La cohorte permanece fija por área, definida por coincidencia de CLUES con actividad SINBA 2026 y EDS 2026.
Los filtros recalculan las series, KPI, CSV y presentaciones. En los informes completos, el filtro de entidad se aplica por área; una CLUES seleccionada sólo filtra el área donde existe, y las demás áreas se muestran completas.
**Privacidad:** el desglose por CLUES revela actividad a nivel de unidad; no publique `detalle_clues.json` en GitHub Pages público sin autorización y evaluación de divulgación. GitHub Pages es público incluso si el repositorio tiene restricciones.

## Cambios v3 (revisión ejecutiva)

- Los escenarios `ce_2025` y `ce_2026` **siguen calculándose** y figuran en `series_semanales.json`, pero se ocultan en la interfaz y en los informes.
- Nuevo escenario `integral_triple`: SINBA 2025 y 2026 (CE+PF+SM+SB) frente a EDS MoCE 2026. Se deriva de `detalle_clues.json` para mantener filtros geográficos y por unidad.
- Indicador: para series 2026/2026, proporción de registros EDS en el volumen conjunto. Para 2025/2026, relación de volúmenes EDS 2026 / SINBA 2025, **no** una tasa de adopción.
- Nuevo `data/auditoria_clues.json` generado por Python. La auditoría visual responde a entidad y CLUES del área seleccionada; **no** muestra como cero los registros sin CLUES, que no son geolocalizables. El resumen global permanece en `resumen_calidad.json`.
- Las exportaciones PPTX y PDF usan los fondos derivados de `plantilla.pptx` (portada y contenido), ubicados en `assets/plantilla_1.jpg` y `assets/plantilla_2.jpg`. No se incluye página final de auditoría. La auditoría permanece disponible en el tablero y los JSON.
- Para preservar privacidad, los JSON por CLUES deben publicarse solo con autorización expresa de la institución.

Reprocesar los archivos originales después de actualizar el proyecto:

```bash
python scripts/build_data.py --config config/sources.json --as-of 2026-10-09
python -m http.server 8085
```

La plantilla se integra como imágenes de fondo, por lo que sus elementos institucionales no son editables individualmente en los informes. El texto y los gráficos exportados se superponen sobre esos fondos.
