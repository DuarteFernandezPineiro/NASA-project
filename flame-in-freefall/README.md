# Flame in Freefall

Panel para explorar los ensayos de BASS-II en la Estación Espacial Internacional. Incluye un mapa de inflamabilidad, filtros, comparación de hasta tres ensayos, resultados, descargas CSV y grabaciones vinculadas a las fichas.

## Abrir en local

Con Node.js 22 o posterior, abre PowerShell en esta carpeta y ejecuta:

```powershell
node server.mjs
```

Abre [el panel local](http://127.0.0.1:4187). Para activar la IA, copia `.env.example` a `.env`, introduce una `OPENAI_API_KEY` válida y reinicia el servidor. También se acepta la variable del entorno si el archivo local está vacío o ausente. `.env` está excluido del repositorio.

## Consulta IA (RAG)

La consulta recupera evidencia de tres fuentes, todas en `dist/chunks.json` o `dist/trials.json`:

- **Informe BASS-II** (NASA/TM-20210011385): 238 pasajes de las secciones 1 a 7 y los apéndices B a D, cada uno con su sección y página.
- **Guía de combustión en la ISS** ([NP-2015-10-034-JSC](https://www.nasa.gov/sites/default/files/atoms/files/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf), 2015): 88 pasajes de contexto sobre otros experimentos (FLEX, SLICE, BRE…), principios de la combustión en microgravedad e instalaciones. Sus citas aparecen como `Guide·pN`. Ocupa como máximo cuatro de las nueve fuentes cuando el informe tiene candidatos, y no se usa en preguntas sobre un ensayo concreto.
- **Observaciones de los 126 ensayos** del apéndice A.

- **Búsqueda por palabras clave (BM25)**: funciona siempre, sin clave. Las preguntas en español se amplían con un glosario al vocabulario inglés del informe.
- **Búsqueda semántica**: se activa si existe `dist/vectors.json`. La pregunta se convierte en un vector con `text-embedding-3-small` (256 dimensiones) y ambos rankings se combinan por fusión de rangos recíprocos.

Para regenerar el índice, con Python y `pdfplumber`:

```powershell
python scripts/build-index.py           # solo pasajes
python scripts/build-index.py --embed   # pasajes y vectores (usa OPENAI_API_KEY del entorno o de .env)
```

La respuesta de IA se genera a partir de los pasajes recuperados e puede incluir una interpretación para seguridad contra incendios cuando se pregunta por ella y los pasajes la respaldan dentro de las condiciones ensayadas. Cada afirmación devuelve los identificadores de las fuentes utilizadas y el servidor los convierte en enlaces al PDF. Si el servicio de IA falta o falla, la interfaz indica que está mostrando resultados de búsqueda documental.

Las [diez pruebas ejecutables y sus resultados](PRUEBAS-IA.md) cubren ambos modos y verifican la abstención para gravedad lunar.

## Datos y exportación

La [tabla de campos y decisiones](DATOS-BASS-II.md) explica las unidades, el significado de los valores originales y el tratamiento de datos ausentes o ambiguos. El comparador marca condiciones distintas y permite descargar la selección. La tabla de ensayos exporta todos los resultados de los filtros, aunque ocupen varias páginas.

## Catálogo PSI

El explorador PSI incluye todas las tablas CSV del repositorio, con búsqueda, tipo de registro, línea de origen y exportación de la tabla filtrada. La [cobertura y metodología](DATOS-PSI.md) incluye los recuentos por tabla y los comandos de importación.

## Fuentes

- El [catálogo PSI-25](https://doi.org/10.60555/4qc4-de67) aporta 129 registros y las grabaciones iniciales de B1, B3 y F1. Las vistas y secuencias adicionales proceden del [archivo BASS-II de SDSU](http://flame.sdsu.edu/bass.html), citado en la sección 2.1.2 del informe de NASA. Se convierten a MP4 para reproducción web. El catálogo `dist/media/catalog.json` conserva las fuentes y duraciones.
- El [informe NASA/TM-20210011385](https://ntrs.nasa.gov/citations/20210011385) documenta los resultados. El cruce por identificador de ensayo y muestra enlaza 126 filas con las tablas del apéndice A. Los registros O20, O21 y O22 solo llevan la ficha del CSV.
- Los valores de los instrumentos se muestran tal como se publicaron. En particular, `Air display` puede reflejar un punto, una secuencia o una anotación. Para el filtro de dirección se usa la matriz de NASA cuando especifica un flujo opuesto, concurrente o de estancamiento.
- Para regenerar `dist/trials.json`, usa Python con `pdfplumber` y ejecuta `python scripts/import-data.py`. El script lee el PDF y CSV originales en la carpeta superior.
