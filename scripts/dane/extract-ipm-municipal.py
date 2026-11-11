"""
Extrae del anexo oficial del DANE "Medida de pobreza multidimensional municipal de fuente
censal 2018" los valores de los municipios de estudio y los escribe como JSON
(lib/demografia/data/ipm-municipal-2018.json).

Es un dato del Censo 2018: no cambia, así que el JSON del proyecto es la caché permanente y
no hace falta volver a pedirlo en tiempo de ejecución. El archivo se descarga de www.dane.gov.co,
que no depende del geoportal.

Uso:
  curl -L -o anexo.xlsx https://www.dane.gov.co/files/investigaciones/condiciones_vida/pobreza/2018/informacion-censal/anexo-censal-pobreza-municipal-2018.xlsx
  python extract-ipm-municipal.py anexo.xlsx lib/demografia/data/ipm-municipal-2018.json

Requiere: pip install openpyxl
"""

import json
import sys

import openpyxl

MUNICIPIOS = {
    "76736": "Sevilla",
    "76122": "Caicedonia",
    "76895": "Zarzal",
    "76622": "Roldanillo",
}
DOMINIOS = ("total", "cabeceras", "rural")
SOURCE_URL = (
    "https://www.dane.gov.co/files/investigaciones/condiciones_vida/pobreza/2018/"
    "informacion-censal/anexo-censal-pobreza-municipal-2018.xlsx"
)


def number(value):
    """Convierte una celda a número; los valores no numéricos (reserva estadística) quedan en None."""
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


def rows_of(workbook, name):
    return list(workbook[name].iter_rows(values_only=True))


def main(source: str, target: str) -> None:
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)

    ipm = {}
    for row in rows_of(workbook, "4_IPM Mpio dominios")[1:]:
        code = str(row[0]).strip() if row[0] is not None else ""
        if code in MUNICIPIOS:
            ipm[code] = {"total": number(row[2]), "cabeceras": number(row[3]), "rural": number(row[4])}

    # Hoja de privaciones por dominio: fila 0 con el nombre de cada privación (una sola celda por
    # grupo de tres columnas), fila 1 con Total / Cabeceras / Centros poblados y rural disperso.
    sheet = rows_of(workbook, "8_Privaciones Mpio dominio")
    header, names = sheet[0], []
    current = None
    for cell in header[2:]:
        if cell is not None:
            current = str(cell).strip()
        names.append(current)

    privaciones = {code: {} for code in MUNICIPIOS}
    for row in sheet[2:]:
        code = str(row[0]).strip() if row[0] is not None else ""
        if code not in MUNICIPIOS:
            continue
        for offset, name in enumerate(names):
            slot = DOMINIOS[offset % 3]
            privaciones[code].setdefault(name, {})[slot] = number(row[2 + offset])

    output = {
        "fuente": "DANE, Medida de pobreza multidimensional municipal de fuente censal, Censo Nacional de Población y Vivienda 2018",
        "fuenteUrl": SOURCE_URL,
        "anio": 2018,
        "municipios": {
            code: {
                "codigo": code,
                "municipio": MUNICIPIOS[code],
                "ipm": ipm[code],
                "privaciones": privaciones[code],
            }
            for code in MUNICIPIOS
        },
    }
    with open(target, "w", encoding="utf-8") as out:
        json.dump(output, out, ensure_ascii=False, indent=1)

    for code, entry in output["municipios"].items():
        print(f"{code} {entry['municipio']:<11} IPM {entry['ipm']} | privaciones: {len(entry['privaciones'])}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
