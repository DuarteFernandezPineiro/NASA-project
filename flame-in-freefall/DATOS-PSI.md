# Catálogo de datos NASA PSI

El panel integra las **23 tablas CSV de 21 investigaciones** presentes en GitHub. El catálogo contiene **2.016 filas de origen**, incluidas notas, registros de mantenimiento y referencias. Los ensayos con resultados estructurados de BASS‑II conservan su propio explorador y sus citas al informe. Cada tabla del catálogo enlaza a la ficha oficial de la [NASA Physical Sciences Informatics](https://www.nasa.gov/physical-sciences-informatics-psi/psi-investigations-by-research-area/).

## Cobertura

| PSI                                                                     | Tabla                     | Qué representa cada fila                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25)   | BASS-II                   | 129 ensayos de sólidos. El explorador BASS-II añade los resultados del informe.                                                    |
| [PSI-26](https://psi.nasa.gov/physci/repo/data/investigations/PSI-26)   | BASS                      | 121 corridas y 1 entrada de limpieza de hollín. La tabla da identificadores y materiales.                                          |
| [PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98)   | Saffire-I                 | 2 muestras y 2 entradas de imagen previa.                                                                                          |
| [PSI-99](https://psi.nasa.gov/physci/repo/data/investigations/PSI-99)   | Saffire-II                | 9 muestras, 2 entradas de imagen previa y 4 notas.                                                                                 |
| [PSI-100](https://psi.nasa.gov/physci/repo/data/investigations/PSI-100) | Saffire-III               | 2 muestras.                                                                                                                        |
| [PSI-69](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69)   | FLEX                      | 274 ensayos de gotas con composición inicial, presión y fin del ensayo.                                                            |
| [PSI-68](https://psi.nasa.gov/physci/repo/data/investigations/PSI-68)   | FLEX-2                    | 8 configuraciones de combustible con intervalos y valores posibles.                                                                |
| [PSI-39](https://psi.nasa.gov/physci/repo/data/investigations/PSI-39)   | Cool Flames Investigation | 87 filas del registro de corridas. Se mantienen 8 repeticiones.                                                                    |
| [PSI-101](https://psi.nasa.gov/physci/repo/data/investigations/PSI-101) | SAME-R                    | 109 corridas, con tiempos de mezcla y envejecimiento cuando constan.                                                               |
| [PSI-102](https://psi.nasa.gov/physci/repo/data/investigations/PSI-102) | SAME                      | 8 configuraciones de muestra, algunas referidas a filas anteriores.                                                                |
| [PSI-47](https://psi.nasa.gov/physci/repo/data/investigations/PSI-47)   | DAFT                      | 2 sesiones de medición de aerosoles.                                                                                               |
| [PSI-20](https://psi.nasa.gov/physci/repo/data/investigations/PSI-20)   | ACME BRE                  | 18 resúmenes de sesión con recuentos de igniciones.                                                                                |
| [PSI-21](https://psi.nasa.gov/physci/repo/data/investigations/PSI-21)   | ACME CLD Flame            | 32 resúmenes de sesión.                                                                                                            |
| [PSI-22](https://psi.nasa.gov/physci/repo/data/investigations/PSI-22)   | ACME E-FIELD Flames       | 21 resúmenes de sesión y 11 filas de detalle de concentración. Incluye 8 repeticiones.                                             |
| [PSI-23](https://psi.nasa.gov/physci/repo/data/investigations/PSI-23)   | ACME s-Flame              | 18 resúmenes de sesión.                                                                                                            |
| [PSI-10](https://psi.nasa.gov/physci/repo/data/investigations/PSI-10)   | Flame Design              | 207 registros de llama normal y 120 de llama inversa, en dos tablas.                                                               |
| [PSI-159](https://psi.nasa.gov/physci/repo/data/investigations/PSI-159) | CFI-G                     | 179 registros de llama normal y 154 de llama inversa, en dos tablas.                                                               |
| [PSI-106](https://psi.nasa.gov/physci/repo/data/investigations/PSI-106) | SLICE                     | 12 resúmenes con fechas, combustible y anotaciones sobre sesiones o calibraciones.                                                 |
| [PSI-107](https://psi.nasa.gov/physci/repo/data/investigations/PSI-107) | SPICE                     | 469 registros de medición. Se mantienen 34 repeticiones. Cada fila puede corresponder a un parámetro distinto de una misma sesión. |
| [PSI-142](https://psi.nasa.gov/physci/repo/data/investigations/PSI-142) | Estudios de llama fría    | 8 referencias a publicaciones y figuras.                                                                                           |
| [PSI-181](https://psi.nasa.gov/physci/repo/data/investigations/PSI-181) | Estudio de soldadura ISSI | Inventario de 7 muestras y sus métodos.                                                                                            |

## Tratamiento

- Cada archivo conserva sus columnas, unidades y valores. El catálogo usa texto para conservar rangos, aproximaciones, códigos, expresiones como `RAMPED`, campos vacíos y celdas con varias lecturas. La interfaz usa un guion para indicar una celda vacía e incluye los valores originales en la descarga.
- La numeración muestra la primera línea física de cada registro, contando la cabecera. Las repeticiones de todos los campos después de recortar los espacios exteriores se enlazan a su primera aparición. Se conservan las 50 filas repetidas y las filas nuevas que comparten un identificador o tiempo con una medición previa.
- Solo se eliminan las líneas totalmente vacías. El tipo de fila se asigna según el encabezado y el contenido. En E-FIELD, las concentraciones sin fecha quedan como detalle. En Saffire, notas e identificadores de imagen previa quedan visibles y filtrables.
- La búsqueda abarca todas las columnas de la tabla seleccionada. El CSV descarga todas las filas que coinciden con los filtros, con identificador PSI, archivo, línea, tipo, primera aparición cuando se repite y enlace de NASA. Las celdas que una hoja de cálculo podría ejecutar como fórmula se neutralizan al exportar.
- Las tablas tienen métodos y unidades distintos. El catálogo muestra la cobertura y los valores de origen. Los recuentos cuentan filas de procedencia.

## Regenerar y probar

Desde `flame-in-freefall`, ejecuta:

```powershell
python -B scripts/import-psi-catalog.py
python -B scripts/import-psi-extra.py
npm run test:ai
node scripts/build-site.mjs
```

El primer importador lee los CSV NASA PSI de la carpeta superior y genera `dist/psi-catalog.json`. Cuando cambie el inventario, añade la nueva tabla al importador indicando qué representa una fila. El segundo actualiza las vistas existentes de FLEX, Saffire-II y BASS. Ambos respetan UTF-8 y permiten leer el archivo FLEX original en Windows-1252.
