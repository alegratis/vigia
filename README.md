# Vigía

**Vigía** es una plataforma de código abierto para la transformación de condiciones de vulnerabilidad social frente a amenazas naturales en cuatro municipios del Valle del Cauca, Colombia: **Sevilla, Caicedonia, Zarzal y Roldanillo**.

Cruza fenómenos naturales de deslizamiento, inundación e incendio forestal con la población y la infraestructura crítica expuestas, combinando índices de amenaza estáticos con pronósticos y monitoreo en vivo de fuentes abiertas. Ese cruce se completa con el Índice de Vulnerabilidad Social (IVS) de la capa de Demografía, que mide la condición social previa de la población, no el peligro del lugar. La app no mantiene una base de datos propia: cada capa es una agregación en tiempo real sobre servicios geoespaciales públicos (ArcGIS, WMS, WMTS, APIs REST).

> **Vigía está en línea:** accede a la plataforma en **[vigia.redlabot.org](https://vigia.redlabot.org)**. Está en fase **beta**; el indicador de versión (`Beta v0.N`) aparece en la ventana "Acerca de" y en la documentación, y avanza por sí solo con cada integración al repositorio.

## El mapa

La página principal es el propio mapa: un único lienzo multicapa que abre con la capa de **Riesgo compuesto** activa. Desde ahí puedes:

- **Combinar capas:** activa hasta tres a la vez desde el riel lateral y ajusta la opacidad de cada una. Clima, Demografía e Hidrantes no se combinan con otras capas.
- **Filtrar por municipio** (Sevilla, Caicedonia, Zarzal, Roldanillo o todos) y alternar entre vista **2D y 3D**.
- **Abrir el reporte de una vereda** tocándola en el mapa, con opción de exportarlo a PDF.
- **Compartir la vista:** el botón "Compartir vista" copia un enlace que reproduce las capas, el municipio, el zoom y el centro del mapa. Esos parámetros viven en la URL (`?layers=`, `municipio`, `is3D`, `zoom`, `center`) y se recuerdan en el dispositivo para la próxima visita.
- **Acerca de:** el botón "i" de la barra superior abre una ventana con la explicación breve de la plataforma, los créditos y la versión beta, con un enlace a la documentación completa.

El logo de RED LabOT de la barra superior enlaza a [www.redlabot.org](https://www.redlabot.org).

## Capas

Las capas se identifican con un slug, usado en el parámetro `?layers=<slug>[,<slug>]`:

| Capa | Slug | Qué muestra | Fuentes principales |
| --- | --- | --- | --- |
| **Deslizamientos** | `deslizamientos` | Amenaza por vereda con un modelo propio inspirado en LHASA (NASA): pendiente, proximidad a vías y a fallas geológicas como susceptibilidad estática, ajustada por un disparador de lluvia reciente. Cruzada con población e infraestructura crítica expuesta. | Modelo propio RED LabOT, SGC (fallas), NASA SMAP L4 |
| **Inundaciones** | `inundaciones` | Susceptibilidad estática por zona (Sevilla y Caicedonia) más un modelo propio por vereda para los cuatro municipios: zonificación oficial, distancia a fuente hídrica y planicie del terreno. Se cruza con el pronóstico de caudal en vivo evaluado contra períodos de retorno locales. | GEOGLOWS (52 modelos de conjunto), modelo propio RED LabOT, NASA GPM IMERG |
| **Incendios** | `incendios` | Amenaza por vereda a partir de un modelo propio: pendiente, cercanía a vías, recurrencia histórica de focos e Índice Meteorológico de Incendio (FWI) del día, calculado con las ecuaciones del Sistema Canadiense de Índices Forestales de Incendio. | NASA FIRMS (VIIRS y MODIS), Copernicus GWIS/EFFIS, modelo propio RED LabOT |
| **Precipitación** | `precipitacion` | Lluvia acumulada de los últimos 7 días por vereda y tasa de precipitación satelital casi en tiempo real. Única capa de amenaza con el mismo detalle en los cuatro municipios. | NASA POWER, NASA GPM IMERG |
| **Clima** | `clima` | Reporte meteorológico convencional: temperatura, sensación térmica, estado del cielo, pronóstico a 7 días y perspectiva de racha seca. No es una capa de amenaza y no entra en el riesgo compuesto. | Open-Meteo |
| **Sismología** | `sismologia` | Epicentros en vivo del USGS combinados con el catálogo histórico del Servicio Geológico Colombiano, para estimar la exposición sísmica de cada vereda por distancia a los eventos registrados. | USGS, Servicio Geológico Colombiano |
| **Demografía** | `demografia` | Indicadores del geoportal de DANE extruidos en 3D —pobreza multidimensional por municipio y viviendas/hogares/personas por manzana censal— además del Índice de Vulnerabilidad Social (IVS), propio de esta app, que cruza esas condiciones sociales con el riesgo físico de las demás capas. | DANE (geoportal), modelo propio RED LabOT |
| **Hidrantes** | `hidrantes` | Herramienta operativa para el casco urbano de Sevilla: geolocaliza al usuario (o un punto elegido en el mapa), resalta el hidrante más cercano y traza una ruta aproximada por calles, con las instituciones educativas, de salud y de gobierno cercanas señaladas como polígonos. | OpenStreetMap, levantamiento propio de instituciones |
| **Riesgo compuesto** | `riesgo-compuesto` | No es una amenaza más, sino la conclusión de las demás: cruza deslizamientos, inundaciones, incendios, precipitación y sismología en una sola evaluación por vereda (gobierna el nivel más alto), con reporte narrativo y exposición demográfica. | Modelos internos |

Todas las capas de amenaza cubren Sevilla y Caicedonia con el mayor detalle; Precipitación es la única capa de amenaza con esa misma cobertura en Zarzal y Roldanillo, y Clima ofrece su reporte meteorológico en los cuatro municipios por igual.

## Documentación

`/documentacion` es una página independiente (se abre en una pestaña nueva desde el enlace "Documentación" del mapa y desde la ventana "Acerca de") con la guía completa de uso, funcionalidades por módulo, fuentes de datos, metodología, marco teórico, arquitectura y licencias. Es la referencia más detallada y siempre actualizada sobre qué calcula cada modelo y de dónde vienen sus datos.

## Arquitectura

- **Framework:** Next.js 16 (App Router) con React 19 y TypeScript. Las páginas son Server Components por defecto; los mapas y controles interactivos se marcan `"use client"` solo donde necesitan estado o efectos del navegador.
- **Acceso a datos, sin base de datos propia:** cada fuente externa tiene un módulo server-only en `lib/<amenaza>/` que llama directamente a su API/WMS/WMTS pública. No hay capa de persistencia: la app es una capa de agregación en vivo sobre servicios públicos ya existentes.
- **Rutas de API y hooks de datos:** cada módulo servidor se expone mediante una ruta en `app/api/**/route.ts`, que envuelve el resultado en un sobre JSON consistente (`{ data }` o `{ error }`). Los componentes cliente consumen esas rutas con hooks de SWR para caché y revalidación en el navegador.
- **Estrategia de caché:** el caché de fetch de Next (`next: { revalidate }`) se ajusta por fuente según qué tan rápido cambia — FIRMS cada 15 min, capas de ArcGIS cada hora, límites administrativos cada semana — y las proyecciones del DANE se leen de un JSON estático versionado en el repositorio, sin llamada de red.
- **Mapas:** MapLibre GL (vía react-map-gl), importado dinámicamente con `next/dynamic({ ssr: false })`. Cada capa aporta fuentes GeoJSON, capas de símbolos/círculos, teselas vectoriales y overlays raster o WMS según la forma de su fuente, todo compuesto en un único WebGL canvas. El basemap usa teselas de CARTO.
- **Estilos:** Tailwind CSS v4 con tokens de diseño semánticos en `app/globals.css` (escalas de color en oklch por amenaza/categoría), componentes de shadcn/ui sobre primitivas de Base UI, y next-themes para el tema claro/oscuro/sistema.
- **Gráficas:** Recharts mediante los componentes de gráfico de shadcn/ui.
- **Exportación a PDF:** los reportes de Riesgo compuesto y Demografía usan html2canvas-pro (compatible con los colores lab()/oklch() de Tailwind v4) para capturar el panel como imagen y jsPDF para componer el documento final.
- **Despliegue:** Vercel. Vercel Analytics solo se activa en producción.

### Estructura del proyecto

```
app/            Rutas, páginas y endpoints de API (App Router)
  page.tsx      Página principal: el mapa multicapa
  api/          Un endpoint por fuente/dominio (app/api/<amenaza>/route.ts)
  documentacion/  Página independiente de documentación
components/     Espacio de trabajo del mapa (components/laboratorio), mapas (components/maps) y componentes por amenaza (components/<amenaza>)
lib/            Clientes de datos y lógica por dominio (lib/<amenaza>); catálogo de capas en lib/laboratorio/layers.ts
public/         Imágenes y recursos estáticos
```

Cada amenaza sigue el mismo patrón: un cliente de datos y un ensamblador por servidor en `lib/<amenaza>/`, un endpoint en `app/api/<amenaza>/` y sus componentes (tarjetas de datos en vivo, paneles de modelo, gráficas) en una única carpeta por categoría, `components/<amenaza>/`, usando siempre el slug en español (`clima`, `demografia`, `deslizamientos`, `hidrantes`, `incendios`, `inundaciones`, `precipitacion`, `riesgo-compuesto`, `sismologia`) — no debe crearse una segunda carpeta en inglés para la misma categoría. El catálogo de capas, los controles de cada una y el estado compartible de la vista viven en `lib/laboratorio/layers.ts`; añadir una entrada allí registra la capa en el riel del mapa.

Las URLs de versiones anteriores de la plataforma (`/deslizamientos`, `/clima`, `/maps/<slug>`, `?categoria=<slug>`, etc.) redirigen a la página principal con la capa correspondiente activa (ver `next.config.mjs`).

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
