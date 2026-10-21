# v4.3 – Comparación temporal y búsqueda de CLUES

- Selectores de semana ISO inicial y final, con validación de rango.
- Gráficas semanal y acumulada acotadas al intervalo; la acumulada conserva la línea base de las semanas anteriores al inicio.
- Resumen de cortes acumulados S-inicial y S-final con incremento de registros.
- Búsqueda de CLUES por código o nombre desde `config/unidades_catalogo.csv`, respetando grupo y entidad.
- CSV exportado solo para el intervalo seleccionado.
- El mapa y las barras se mantienen al corte final, no se sustituyen.
- La auditoría existente no tiene dimensión semanal: se advierte expresamente para evitar atribuirle un intervalo falso.
- El ZIP no contiene los cinco JSON generados; es necesario ejecutar `scripts/build_data.py` con las fuentes locales antes de publicar.
- Vista mensual conserva la metodología de agrupación mensual preexistente; sus cortes por semanas no equivalen a meses parciales exactos.
