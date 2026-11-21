"""
Extrae de los shapefiles públicos del DANE las manzanas de los cuatro municipios de estudio y
escribe un único JSON (lib/demografia/data/manzanas-2018.json) con, por manzana:

- IPM y categoría de vulnerabilidad (SHP_VULNRB_IPMxMZ.zip, campos ipm y LABEL)
- viviendas, hogares y personas del Censo 2018 (SHP_MGN2018_INTGRD_MANZ.zip, campos TVIVIENDA,
  TP16_HOG y TP27_PERSO)
- la geometría (la del shapefile del IPM, que coincide con la del MGN)

Son datos del Censo 2018: no cambian, así que el JSON del proyecto es la caché permanente y la
aplicación deja de depender del geoportal del DANE en tiempo de ejecución.

Uso:
  curl -L -o ipm.zip https://www.dane.gov.co/files/geoportal-provisional/SHP_VULNRB_IPMxMZ.zip
  curl -L -o mgn.zip https://www.dane.gov.co/files/geoportal-provisional/SHP_MGN2018_INTGRD_MANZ.zip
  unzip -q ipm.zip -d ipm && unzip -q mgn.zip -d mgn
  python extract-manzanas.py ipm/VULNRB_IPMxMZ mgn/MGN_ANM_MANZANA lib/demografia/data/manzanas-2018.json

Requiere: pip install pyshp
"""

import json
import sys
import warnings

import shapefile

warnings.filterwarnings("ignore", category=UserWarning)

MUNICIPIOS = {"76736": "Sevilla", "76122": "Caicedonia", "76895": "Zarzal", "76622": "Roldanillo"}
# Conteos de manzanas conocidos para estos municipios (los mismos que publicaba el servicio del geoportal).
EXPECTED = {"76736": 515, "76122": 387, "76895": 563, "76622": 709}
DECIMALS = 6


def round_coords(value):
    if isinstance(value, (list, tuple)):
        if value and isinstance(value[0], (int, float)):
            return [round(value[0], DECIMALS), round(value[1], DECIMALS)]
        return [round_coords(item) for item in value]
    return value


def main(ipm_path: str, mgn_path: str, target: str) -> None:
    mgn = shapefile.Reader(mgn_path, encoding="utf-8")
    fields = [f[0] for f in mgn.fields[1:]]
    for needed in ("COD_DANE_A", "MPIO_CDPMP", "TVIVIENDA", "TP16_HOG", "TP27_PERSO"):
        if needed not in fields:
            sys.exit(f"Falta el campo {needed} en el shapefile del MGN")
    idx = {name: fields.index(name) for name in ("COD_DANE_A", "MPIO_CDPMP", "TVIVIENDA", "TP16_HOG", "TP27_PERSO")}

    counts = {}
    for record in mgn.iterRecords():
        if record[idx["MPIO_CDPMP"]] in MUNICIPIOS:
            counts[record[idx["COD_DANE_A"]]] = {
                "viviendas": int(record[idx["TVIVIENDA"]] or 0),
                "hogares": int(record[idx["TP16_HOG"]] or 0),
                "personas": int(record[idx["TP27_PERSO"]] or 0),
            }

    ipm = shapefile.Reader(ipm_path, encoding="utf-8")
    ipm_fields = [f[0] for f in ipm.fields[1:]]
    col = {name: ipm_fields.index(name) for name in ("COD_MPIO", "COD_DANE", "ipm", "LABEL")}

    wanted = [i for i, record in enumerate(ipm.iterRecords()) if record[col["COD_MPIO"]] in MUNICIPIOS]

    features = []
    per_municipio = {code: 0 for code in MUNICIPIOS}
    without_census = 0
    for i in wanted:
        record = ipm.record(i)
        code = record[col["COD_MPIO"]]
        manzana = record[col["COD_DANE"]]
        census = counts.get(manzana)
        if census is None:
            without_census += 1
            census = {"viviendas": 0, "hogares": 0, "personas": 0}
        geometry = ipm.shape(i).__geo_interface__
        geometry = {"type": geometry["type"], "coordinates": round_coords(geometry["coordinates"])}
        features.append({
            "type": "Feature",
            "properties": {
                "municipio": MUNICIPIOS[code],
                "codigoMunicipio": code,
                "codigoManzana": manzana,
                "ipm": float(record[col["ipm"]] or 0),
                "categoria": str(record[col["LABEL"]] or ""),
                **census,
            },
            "geometry": geometry,
        })
        per_municipio[code] += 1

    for code, name in MUNICIPIOS.items():
        flag = "OK" if per_municipio[code] == EXPECTED[code] else f"DISTINTO (esperado {EXPECTED[code]})"
        print(f"{code} {name:<11} {per_municipio[code]:>4} manzanas  {flag}")
    print(f"total: {len(features)} | manzanas sin dato censal: {without_census}")

    with open(target, "w", encoding="utf-8") as out:
        json.dump(
            {
                "fuente": "DANE, Marco Geoestadístico Nacional integrado con el Censo Nacional de Población y Vivienda 2018 (IPM y nivel de vulnerabilidad por manzana)",
                "fuenteUrl": "https://www.dane.gov.co/files/geoportal-provisional/index.html",
                "anio": 2018,
                "type": "FeatureCollection",
                "features": features,
            },
            out,
            ensure_ascii=False,
            separators=(",", ":"),
        )


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
