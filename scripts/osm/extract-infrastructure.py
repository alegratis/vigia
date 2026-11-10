"""
Extrae del extracto de OpenStreetMap de Colombia lo que antes se pedía a Overpass:

1. Infraestructura (comercio, salud, finanzas, gobierno, social), con el mismo filtro y el
   mismo recuadro que la consulta de lib/osm/overpass.ts. Se escribe con la forma de una
   respuesta de Overpass ({"elements": [...]}) para pasarla por la misma clasificación.
2. Vértices de la red vial (lib/deslizamientos/road-proximity.ts), aligerados a un vértice por
   celda de ~110 m. El modelo usa un radio de influencia de 1 km, así que ese error no cambia
   ningún resultado y la copia pasa de decenas de MB a unos pocos.

Uso:
  python extract-infrastructure.py colombia-latest.osm.pbf infraestructura.json vias.json

Requiere: pip install osmium
Los nodos se leen tal cual; las vías usan el centro de su recuadro (igual que `out center`).
Las relaciones se omiten: en esta zona casi no hay comercios mapeados como relación.
"""

import json
import sys

import osmium

# south, west, north, east: igual que AOI_BBOX en lib/osm/overpass.ts
SOUTH, WEST, NORTH, EAST = 3.88, -76.25, 4.62, -75.72

AMENITIES = {
    "hospital", "clinic", "doctors", "dentist", "pharmacy", "veterinary",
    "bank", "bureau_de_change", "atm",
    "townhall", "courthouse", "police", "fire_station", "post_office", "embassy",
    "social_facility", "community_centre", "place_of_worship", "library",
    "restaurant", "cafe", "fast_food", "bar", "pub", "fuel", "marketplace", "cinema",
    "theatre", "nightclub", "car_wash", "car_rental", "driving_school",
}
# igual que ROAD_QUERY en lib/deslizamientos/road-proximity.ts
ROADS = {
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "unclassified", "residential", "track", "path",
}
KEEP_KEYS = ("name", "amenity", "shop", "office", "craft", "healthcare")
ROAD_CELL_DEGREES = 0.001


def matches(tags) -> bool:
    return bool(
        tags.get("shop")
        or tags.get("office")
        or tags.get("craft")
        or tags.get("healthcare")
        or tags.get("amenity") in AMENITIES
    )


def inside(lat: float, lon: float) -> bool:
    return SOUTH <= lat <= NORTH and WEST <= lon <= EAST


def trimmed(tags) -> dict:
    return {key: tags[key] for key in KEEP_KEYS if key in tags}


def main(source: str, infra_target: str, roads_target: str) -> None:
    elements = []
    road_cells = {}
    skipped_ways = 0

    processor = (
        osmium.FileProcessor(source, osmium.osm.NODE | osmium.osm.WAY)
        .with_locations()
        .with_filter(osmium.filter.KeyFilter("shop", "office", "craft", "amenity", "healthcare", "highway"))
    )
    for obj in processor:
        tags = obj.tags

        if obj.is_way() and tags.get("highway") in ROADS:
            points = [(n.location.lat, n.location.lon) for n in obj.nodes if n.location.valid()]
            if any(inside(lat, lon) for lat, lon in points):
                for lat, lon in points:
                    cell = (round(lat / ROAD_CELL_DEGREES), round(lon / ROAD_CELL_DEGREES))
                    road_cells.setdefault(cell, (round(lat, 5), round(lon, 5)))

        if not matches(tags):
            continue
        if obj.is_node():
            if not obj.location.valid() or not inside(obj.location.lat, obj.location.lon):
                continue
            elements.append({
                "type": "node", "id": obj.id,
                "lat": round(obj.location.lat, 6), "lon": round(obj.location.lon, 6),
                "tags": trimmed(tags),
            })
        else:
            lats, lons = [], []
            for node in obj.nodes:
                if node.location.valid():
                    lats.append(node.location.lat)
                    lons.append(node.location.lon)
            if not lats:
                skipped_ways += 1
                continue
            lat = (min(lats) + max(lats)) / 2
            lon = (min(lons) + max(lons)) / 2
            if not inside(lat, lon):
                continue
            elements.append({
                "type": "way", "id": obj.id,
                "center": {"lat": round(lat, 6), "lon": round(lon, 6)},
                "tags": trimmed(tags),
            })

    with open(infra_target, "w", encoding="utf-8") as out:
        json.dump({"elements": elements}, out, ensure_ascii=False, separators=(",", ":"))
    with open(roads_target, "w", encoding="utf-8") as out:
        json.dump({"vertices": [[lat, lon] for lat, lon in road_cells.values()]}, out, separators=(",", ":"))
    print(f"infraestructura: {len(elements)} elementos (vías sin ubicación: {skipped_ways})")
    print(f"red vial: {len(road_cells)} vértices tras aligerar a celdas de {ROAD_CELL_DEGREES} grados")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
