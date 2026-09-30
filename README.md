# Vigía

**Vigía** es una plataforma de código abierto para la transformación de condiciones de vulnerabilidad social frente a amenazas naturales en cuatro municipios del Valle del Cauca, Colombia: **Sevilla, Caicedonia, Zarzal y Roldanillo**.

Cruza fenómenos naturales de deslizamiento, inundación e incendio forestal con la población y la infraestructura crítica expuestas, combinando índices de amenaza estáticos con pronósticos y monitoreo en vivo de fuentes abiertas. Ese cruce se completa con el Índice de Vulnerabilidad Social (IVS) del panel de Demografía, que mide la condición social previa de la población, no el peligro del lugar. La app no mantiene una base de datos propia: cada vista es una capa de agregación en tiempo real sobre servicios geoespaciales públicos (ArcGIS, WMS, WMTS, APIs REST).

> **Vigía está en línea:** accede a la plataforma en **[vigia.redlabot.org](https://vigia.redlabot.org)**.

## Amenazas y capas

La plataforma organiza la información en ocho mapas interactivos, seleccionables mediante el parámetro `?categoria=<slug>` sobre la página principal:

| Mapa | Slug | Qué muestra | Fuentes principales |
| --- | --- | --- | --- |
| **Deslizamientos** | `deslizamientos` | Amenaza por vereda con un modelo propio inspirado en LHASA (NASA): pendiente, proximidad a vías y a fallas geológicas como susceptibilidad estática, ajustada por un disparador de lluvia reciente. Cruzada con población e infraestructura crítica expuesta. | Modelo propio RED LabOT, SGC (fallas), NASA SMAP L4 |
| **Inundaciones** | `inundaciones` | Susceptibilidad estática por zona (Sevilla y Caicedonia) más un modelo propio por vereda para los cuatro municipios: zonificación oficial, distancia a fuente hídrica y planicie del terreno. Se cruza con el pronóstico de caudal en vivo evaluado contra períodos de retorno locales. | GEOGLOWS (52 modelos de conjunto), modelo propio RED LabOT, NASA GPM IMERG |
| **Incendios** | `incendios` | Amenaza por vereda a partir de un modelo propio: pendiente, cercanía a vías, recurrencia histórica de focos e Índice Meteorológico de Incendio (FWI) del día, calculado con las ecuaciones del Sistema Canadiense de Índices Forestales de Incendio. | NASA FIRMS (VIIRS y MODIS), Copernicus GWIS/EFFIS, modelo propio RED LabOT |
| **Precipitación** | `precipitacion` | Lluvia acumulada de los últimos 7 días por vereda y tasa de precipitación satelital casi en tiempo real. Única capa de amenaza con el mismo detalle en los cuatro municipios. | NASA POWER, NASA GPM IMERG |
| **Clima** | `clima` | Reporte meteorológico convencional: temperatura, sensación térmica, estado del cielo, pronóstico a 7 días y perspectiva de racha seca. No es una capa de amenaza y no entra en el riesgo compuesto. | Open-Meteo |
| **Sismología** | `sismologia` | Epicentros en vivo del USGS combinados con el catálogo histórico del Servicio Geológico Colombiano, para estimar la exposición sísmica de cada vereda por distancia a los eventos registrados. | USGS, Servicio Geológico Colombiano |
| **Demografía** | `demografia` | Indicadores del geoportal de DANE extruidos en 3D —pobreza multidimensional por municipio y viviendas/hogares/personas por manzana censal— además del Índice de Vulnerabilidad Social (IVS), propio de esta app, que cruza esas condiciones sociales con el riesgo físico de las demás capas. | DANE (geoportal), modelo propio RED LabOT |
| **Riesgo compuesto** | `riesgo-compuesto` | No es una amenaza más, sino la conclusión de las demás: cruza deslizamientos, inundaciones, incendios, precipitación y sismología en una sola evaluación por vereda (gobierna el nivel más alto), con reporte narrativo y exposición demográfica. | Modelos internos |

Todas las capas de amenaza cubren Sevilla y Caicedonia con el mayor detalle; Precipitación es la única capa de amenaza con esa misma cobertura en Zarzal y Roldanillo, y Clima ofrece su reporte meteorológico en los cuatro municipios por igual.

## Conoce tu nivel de exposición

Además de los ocho mapas, la página principal incluye un selector de municipio → vereda (o "Casco Urbano") que centra el mapa en la zona elegida y superpone las amenazas y pronósticos disponibles como capas independientes. Desde ahí se puede exportar el mapa capturado junto con un resumen de las amenazas activas a PDF.

## Documentación

`/documentacion` es una página independiente (no vive dentro del espacio de trabajo de mapas) con la guía completa de uso, funcionalidades por módulo, fuentes de datos, metodología, marco teórico, arquitectura y licencias. Es la referencia más detallada y siempre actualizada sobre qué calcula cada modelo y de dónde vienen sus datos.

## Arquitectura

- **Framework:** Next.js 16 (App Router) con React 19 y TypeScript. Las páginas son Server Components por defecto; los mapas y controles interactivos se marcan `"use client"` solo donde necesitan estado o efectos del navegador.
- **Acceso a datos, sin base de datos propia:** cada fuente externa tiene un módulo server-only en `lib/<amenaza>/` que llama directamente a su API/WMS/WMTS pública. No hay capa de persistencia: la app es una capa de agregación en vivo sobre servicios públicos ya existentes.
- **Rutas de API y hooks de datos:** cada módulo servidor se expone mediante una ruta en `app/api/**/route.ts`, que envuelve el resultado en un sobre JSON consistente (`{ data }` o `{ error }`). Los componentes cliente consumen esas rutas con hooks de SWR para caché y revalidación en el navegador.
- **Estrategia de caché:** el caché de fetch de Next (`next: { revalidate }`) se ajusta por fuente según qué tan rápido cambia — FIRMS cada 15 min, capas de ArcGIS cada hora, límites administrativos cada semana — y las proyecciones del DANE se leen de un JSON estático versionado en el repositorio, sin llamada de red.
- **Mapas:** MapLibre GL (vía react-map-gl), importado dinámicamente con `next/dynamic({ ssr: false })`. Cada amenaza combina fuentes GeoJSON, capas de símbolos/círculos, teselas vectoriales y overlays raster o WMS según la forma de su fuente, todo compuesto en un único WebGL canvas. El basemap usa teselas de CARTO.
- **Estilos:** Tailwind CSS v4 con tokens de diseño semánticos en `app/globals.css` (escalas de color en oklch por amenaza/categoría), componentes de shadcn/ui sobre primitivas de Base UI, y next-themes para el tema claro/oscuro/sistema.
- **Gráficas:** Recharts mediante los componentes de gráfico de shadcn/ui.
- **Exportación a PDF:** el selector de exposición usa html2canvas-pro (compatible con los colores lab()/oklch() de Tailwind v4) para capturar el mapa como imagen y jsPDF para componer el documento final.
- **Despliegue:** Vercel. Vercel Analytics solo se activa en producción.

### Estructura del proyecto

```
app/            Rutas, páginas y endpoints de API (App Router)
  api/          Un endpoint por fuente/dominio (app/api/<amenaza>/route.ts)
  <amenaza>/    Rutas dedicadas cuando el modelo tiene su propia página (ej. app/inundaciones/[slug])
  exposicion/   Selector de exposición por vereda, abierto como ventana emergente
  documentacion/  Página independiente de documentación
  maps/[slug]/  Vista de detalle de cada modelo del catálogo (lib/maps.ts)
components/     Mapas (components/maps), paneles del espacio de trabajo (components/home) y componentes por amenaza (components/<amenaza>)
lib/            Clientes de datos y lógica por dominio (lib/<amenaza>)
public/         Imágenes de las teselas y recursos estáticos
```

Cada amenaza sigue el mismo patrón: un cliente de datos y un ensamblador por servidor en `lib/<amenaza>/`, un endpoint en `app/api/<amenaza>/`, un mapa en `components/maps/` y un panel en `components/home/`. Los componentes específicos de cada amenaza (tarjetas de datos en vivo, paneles de modelo, gráficas) viven en una única carpeta por categoría, `components/<amenaza>/`, usando siempre el slug en español (`clima`, `demografia`, `deslizamientos`, `incendios`, `inundaciones`, `precipitacion`, `riesgo-compuesto`, `sismologia`) — no debe crearse una segunda carpeta en inglés para la misma categoría. El listado central de modelos vive en `lib/maps.ts`; añadir una entrada allí registra automáticamente el slug en la página principal.

## Primeros pasos

Requisitos: Node.js 20+ y un gestor de paquetes (npm, pnpm o yarn).

```bash
# instalar dependencias
npm install

# entorno de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador. La página se actualiza automáticamente al editar los archivos.

```bash
# build de producción
npm run build
npm run start
```

## Variables de entorno

Algunas capas requieren credenciales de servicios externos. Configúralas en un archivo `.env.local`:

| Variable | Uso |
| --- | --- |
| `FIRMS_MAP_KEY` | Clave de NASA FIRMS para los focos de calor del mapa de Incendios. |
| `NEXT_PUBLIC_CARTO_API_KEY` | Clave de CARTO para las teselas del mapa base de MapLibre. |

Las fuentes keyless (Open-Meteo, GEOGLOWS, USGS, Copernicus GWIS/EFFIS, DANE) no requieren configuración adicional.

## Fuentes de datos

Vigía integra datos públicos de NASA POWER, GPM IMERG, NASA FIRMS (VIIRS y MODIS), NASA SMAP L4, Open-Meteo, GEOGLOWS, USGS, el Servicio Geológico Colombiano, Copernicus GWIS/EFFIS, el geoportal del DANE y la Secretaría de Infraestructura del Valle del Cauca, además de los índices de susceptibilidad propios de RED LabOT. Los datos meteorológicos y de pronóstico provienen de modelos numéricos, no de observación directa, y se presentan como apoyo a la prevención, no como pronóstico oficial. El detalle completo de cada fuente, su frecuencia de actualización y su metodología vive en `/documentacion`.

## Licencia

Proyecto de código abierto. Consulta el archivo de licencia del repositorio para los términos de uso.
