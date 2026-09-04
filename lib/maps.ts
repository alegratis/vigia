export type MapModel = {
  slug: string
  title: string
  description: string
  image: string
  imageAlt: string
  tag: string
}

export const mapModels: MapModel[] = [
  {
    slug: "terrain",
    title: "Terrain Explorer",
    description:
      "Contour-based elevation model with slope, ridgeline, and watershed analysis interfaces.",
    image: "/images/terrain-map.png",
    imageAlt: "Topographic terrain map with contour lines and elevation shading",
    tag: "Elevation",
  },
  {
    slug: "satellite",
    title: "Satellite View",
    description:
      "High-resolution orbital imagery with land-use classification and change-detection tools.",
    image: "/images/satellite-map.png",
    imageAlt: "Satellite imagery of a coastline and dense urban area from above",
    tag: "Imagery",
  },
  {
    slug: "routing",
    title: "Route Planner",
    description:
      "Live road network graph with pathfinding, waypoint editing, and travel-time overlays.",
    image: "/images/routing-map.png",
    imageAlt: "Dark navigation map with glowing route lines and waypoints",
    tag: "Navigation",
  },
]

export function getMapModel(slug: string): MapModel | undefined {
  return mapModels.find((m) => m.slug === slug)
}
