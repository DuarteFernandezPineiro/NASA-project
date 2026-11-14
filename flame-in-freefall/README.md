# Flame in Freefall

Panel en español para explorar los ensayos de BASS-II en la Estación Espacial Internacional. Incluye filtros, comparación de hasta tres ensayos y las grabaciones originales B1, B3 y F1.

## Abrir en local

Con Node.js 22 o posterior, abre PowerShell en esta carpeta y ejecuta:

```powershell
node server.mjs
```

Abre [el panel local](http://127.0.0.1:4187). Para activar la IA, copia `.env.example` a `.env`, introduce una `OPENAI_API_KEY` válida y reinicia el servidor. También se acepta la variable del entorno si el archivo local está vacío o ausente. `.env` está excluido del repositorio.

La respuesta de IA se genera a partir de extractos recuperados del informe. Cada afirmación devuelve los identificadores de las fuentes utilizadas y el servidor los convierte en enlaces al PDF. Si el servicio de IA falta o falla, la interfaz indica que está mostrando resultados de búsqueda documental.

## Fuentes

- El [catálogo PSI-25](https://doi.org/10.60555/4qc4-de67) aporta 129 registros y las tres grabaciones incluidas.
- El [informe NASA/TM-20210011385](https://ntrs.nasa.gov/citations/20210011385) documenta los resultados. El cruce por identificador de ensayo y muestra enlaza 126 filas con las tablas del apéndice A. Los registros O20, O21 y O22 solo llevan la ficha del CSV.
- Los valores de los instrumentos se muestran tal como se publicaron. En particular, `Air display` puede reflejar un punto, una secuencia o una anotación. Para el filtro de dirección se usa la matriz de NASA cuando especifica un flujo opuesto, concurrente o de estancamiento.
- Para regenerar `dist/trials.json`, usa Python con `pdfplumber` y ejecuta `python scripts/import-data.py`. El script lee el PDF y CSV originales en la carpeta superior.
