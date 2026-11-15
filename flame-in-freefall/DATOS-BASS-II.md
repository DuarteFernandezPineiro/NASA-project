# Campos y decisiones para el análisis BASS-II

El panel reúne las 129 filas de la [tabla experimental NASA PSI-25](https://doi.org/10.60555/4qc4-de67). El cruce por ensayo y muestra enlaza 126 filas con el [apéndice A del informe NASA/TM-20210011385](https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf#page=111). Los ejemplos muestran valores de origen, con los espacios normalizados durante la importación.

| Campo | Valor original de ejemplo | Unidad o tipo | Fuente | Tratamiento de ausencia o ambigüedad |
| --- | --- | --- | --- | --- |
| Identificador, muestra, PI, fecha y GMT | B1, 147, Bhattacharjee, 2/19/2014, 50 | Identificadores, fecha y día del año | PSI-25, fila 2 | El CSV exportado conserva los identificadores y la fila de procedencia. El cruce con el informe exige ensayo y muestra. |
| Material y familia | B1 «100 micron PMMA film 2 cm wide» | Texto con geometría y dimensiones cuando constan | PSI-25 y material del apéndice A | La familia agrupa descripciones. «Other materials» y «Polymer rod (unspecified)» pueden incluir composiciones, geometrías o condiciones distintas. |
| Dirección del flujo | B1 «Opposed»; O20 sin fila enlazada | Categoría | Matriz del apéndice A | Se traduce la categoría documentada. El comparador muestra «No data» cuando falta la dirección y el CSV deja la celda vacía. |
| Air display | B1 «5»; B22 «5 2 0»; P4 «5 pots 0.4 0.36 0.32 0.308 .3 off» | cm/s para una lectura escalar; el texto puede mezclar lecturas y ajustes | PSI-25, [instrumentación, p. 5](https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf#page=13) y apéndice A | Un valor numérico no negativo que ocupa toda la celda puede entrar en el mapa. Las secuencias, cotas como «<1», ajustes y anotaciones se conservan en ficha, comparación y CSV. El mapa excluye estas entradas e informa de cuántas son. Una lectura única tampoco establece el momento de medición ni un umbral de extinción. |
| Fan display y restrictor | B1 «62» y «2» | Lectura del indicador y configuración | PSI-25, [pp. 4–5](https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf#page=12) | Se conservan como texto. El informe describe la superposición del voltaje como 10× V. El ajuste de potenciómetro conserva su escala y sus notas. |
| O₂ inicial y final calibrado | B3 «22.2» y «21.8»; la nota estima un O₂ inicial de «20.6» | % en volumen | PSI-25, [tabla A.1, p. 104](https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf#page=112) | El mapa usa el O₂ inicial calibrado numérico. La estimación queda en la observación. Se conservan valores atípicos como el O₂ final «1.6» de B2, junto con los valores vacíos o marcadores en el CSV. |
| CO₂ y CO inicial y final | B1 «0.44», «0.44», «0», «6» | % en volumen de CO₂ y ppm de CO | PSI-25, [instrumentación, p. 6](https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf#page=14) | Cero es una lectura. Las fichas y el comparador muestran «No data» ante campos vacíos y marcadores como «none». El CSV conserva el texto publicado. |
| Ignición y propagación | B1 prendió y se propagó hasta la mitad; B7 solo describe una capa de burbujas | Sí, no, desconocido | Observación del apéndice A y extracción de resultados | «Unknown» incluye resultados sin observación suficiente. El porcentaje de cada categoría usa todas las filas del grupo, incluidas las desconocidas. |
| Extinción | B1 se extinguió tras el corte de flujo; F1 se extinguió con el ignitor encendido | Categoría observada | Observación del apéndice A y extracción de resultados | Se muestra el método o estado codificado, «Unknown» si falta evidencia y «Not applicable» si consta que la muestra no prendió. |
| Observación, tabla y página | B22 tabla A.1, p. 104, PDF p. 112 | Texto, identificador de tabla y páginas | Apéndice A | O20, O21 y O22 carecen de fila enlazada. El comparador indica esa ausencia y el CSV deja las referencias vacías. |

## Cobertura actual

| Resultado | Sí | No | Desconocido |
| --- | ---: | ---: | ---: |
| Ignición | 115/129 (89,1 %) | 1/129 (0,8 %) | 13/129 (10,1 %) |
| Propagación | 24/129 (18,6 %) | 4/129 (3,1 %) | 101/129 (78,3 %) |

El mapa incluye 25/129 ensayos. De los 104 excluidos, 100 tienen secuencias o anotaciones y 4 carecen de lectura de aire. Los 25 ensayos con lectura única tienen O₂ inicial válido. Estas proporciones describen los registros disponibles bajo las condiciones ensayadas.

## Exportación

El CSV de filtros incluye todas las páginas de resultados. El de comparación incluye los ensayos seleccionados en el orden de selección. Ambos usan UTF-8 con BOM, separador de coma, encabezados con las unidades disponibles y enlaces a NASA. La columna escalar de aire queda vacía para entradas ambiguas o ausentes y se exporta también el texto de origen. Los resultados desconocidos se exportan como «Unknown». Los prefijos de fórmulas en texto se neutralizan para hojas de cálculo, conservando las lecturas numéricas negativas.
