"""
Extrae las 10 componentes del Índice de Vulnerabilidad Social municipal (lib/vulnerabilidad/ivs.ts)
para los cuatro municipios de estudio, desde dos anexos oficiales del DANE sobre el Censo 2018:

- Déficit habitacional (metodología 2020), hoja "Total Municipios": hogares con cada carencia
  (paredes, pisos, hacinamiento mitigable y no mitigable, agua, alcantarillado, energía, basuras),
  que se convierten a % dividiendo por el total de hogares del municipio.
- NBI, hoja "Municipios": proporción de personas con los componentes de inasistencia escolar y de
  dependencia económica (columna "Total").

Son datos censales fijos: el JSON del proyecto (lib/vulnerabilidad/data/ivs-componentes-2018.json)
es la caché permanente y la aplicación no consulta al DANE en tiempo de ejecución.

Uso:
  curl -L -o deficit.xlsx https://www.dane.gov.co/files/investigaciones/deficit-habitacional/deficit-hab-2020-anexo-nueva-metodologia.xlsx
  curl -L -o nbi.xlsx https://www.dane.gov.co/files/censo2018/informacion-tecnica/CNPV-2018-NBI-DIVIPOLA-2021.xlsx
  python extract-ivs-componentes.py deficit.xlsx nbi.xlsx lib/vulnerabilidad/data/ivs-componentes-2018.json

Requiere: pip install openpyxl
"""

import json
import sys
import warnings

import openpyxl

warnings.filterwarnings("ignore", category=UserWarning)

MUNICIPIOS = {"76736": "Sevilla", "76122": "Caicedonia", "76895": "Zarzal", "76622": "Roldanillo"}

# Componente del IVS -> encabezado de la columna de hogares en el anexo de déficit habitacional.
DEFICIT_COLUMNS = {
    "CompParedesExteriores": "Material de Paredes",
    "CompMaterialPisos": "Material de Pisos",
    "CompHacinMitigable": "Hacinamiento mitigable",
    "CompHacinNoMitigable": "Hacinamiento no mitigable",
    "CompAcueducto": "Agua para cocinar",
    "CompAlcantarillado": "Alcantarillado",
    "CompEnergia": "Energía",
    "CompRecBasura": "Recolección de basuras",
}
# Componente del IVS -> encabezado de la columna "Total" en el anexo de NBI.
NBI_COLUMNS = {
    "ComponenteInasistenciaEscolar": "Componente Inasistencia",
    "ComponenteDependenciaEconomica": "Componente dependencia económica",
}


def rows_of(path, sheet):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    return list(workbook[sheet].iter_rows(values_only=True))


def header_index(rows, label, first_cell):
    """Fila de encabezados: la que contiene `label` en alguna celda. Devuelve (índice de fila, fila)."""
    for i, row in enumerate(rows):
        if any(isinstance(c, str) and c.strip() == first_cell for c in row if c is not None):
            return i, row
    raise SystemExit(f"No se encontró el encabezado {first_cell!r} en {label}")


def main(deficit_path: str, nbi_path: str, target: str) -> None:
    result = {code: {"municipio": name, "componentes": {}} for code, name in MUNICIPIOS.items()}

    rows = rows_of(deficit_path, "Total Municipios")
    start, header = header_index(rows, "déficit", "Municipio")
    cols = {str(c).strip(): j for j, c in enumerate(header) if c is not None}
    for row in rows[start + 1 :]:
        code = str(row[cols["Municipio"]]).strip() if row[cols["Municipio"]] is not None else ""
        if code not in MUNICIPIOS:
            continue
        total = float(row[cols["Total de hogares"]])
        for component, column in DEFICIT_COLUMNS.items():
            result[code]["componentes"][component] = round(float(row[cols[column]]) / total * 100, 4)
        result[code]["hogares"] = int(total)

    rows = rows_of(nbi_path, "Municipios")
    start, header = header_index(rows, "NBI", "Código Departamento")
    sub = rows[start + 1]
    # Las componentes "Total" son las primeras 7 columnas de datos, a partir de la columna 4.
    nbi_cols = {str(sub[j]).strip(): j for j in range(4, 11) if sub[j] is not None}
    for row in rows[start + 2 :]:
        if row[0] is None or row[2] is None:
            continue
        code = f"{str(row[0]).strip().zfill(2)}{str(row[2]).strip().zfill(3)}"
        if code not in MUNICIPIOS:
            continue
        for component, column in NBI_COLUMNS.items():
            result[code]["componentes"][component] = round(float(row[nbi_cols[column]]), 4)

    for code, entry in result.items():
        missing = [k for k in [*DEFICIT_COLUMNS, *NBI_COLUMNS] if k not in entry["componentes"]]
        if missing:
            raise SystemExit(f"{entry['municipio']}: faltan componentes {missing}")

    output = {
        "fuente": "DANE, Déficit habitacional (metodología 2020) y Necesidades Básicas Insatisfechas, Censo Nacional de Población y Vivienda 2018",
        "fuenteUrl": "https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/deficit-habitacional",
        "anio": 2018,
        "municipios": result,
    }
    with open(target, "w", encoding="utf-8") as out:
        json.dump(output, out, ensure_ascii=False, indent=1)

    for code, entry in result.items():
        print(code, f"{entry['municipio']:<11}", {k: round(v, 1) for k, v in entry["componentes"].items()})


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
