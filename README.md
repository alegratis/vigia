# Vigía

**Vigía** es una plataforma de código abierto para la evaluación y gestión de riesgos de desastres a escala municipal y veredal, enfocada en los municipios de **Sevilla, Caicedonia, Zarzal y Roldanillo** (Valle del Cauca, Colombia).

Reúne pronósticos, catálogos históricos y sensores satelitales de múltiples fuentes públicas en una sola lectura por vereda, para ayudar a anticipar dónde actuar antes de que una amenaza se convierta en emergencia. Cada modelo cruza la amenaza con la densidad de población para estimar la exposición humana en cada nivel.

> **Vigía está en línea:** accede a la plataforma en **[vigia.redlabot.org](https://vigia.redlabot.org)**.

## Amenazas y capas

La plataforma organiza la información en siete mapas interactivos, seleccionables mediante el parámetro `?categoria=<slug>`:

| Mapa | Slug | Qué muestra | Fuentes principales |
| --- | --- | --- | --- |
| **Deslizamientos** | `deslizamientos` | Susceptibilidad geológica zonificada en cinco niveles, cruzada con densidad poblacional. | Backend QGIS / inventario de amenaza |
| **Inundaciones** | `inundaciones` | Pronóstico hidrológico de caudales y excedencias por periodo de retorno. | GEOGLOWS (52 modelos de conjunto) |
| **Incendios** | `incendios` | Focos de calor detectados de forma continua alrededor del territorio. | NASA FIRMS (VIIRS) |
| **Precipitación** | `precipitacion` | Lluvia acumulada por vereda y tasa de precipitación casi en tiempo real, con climatología quinquenal. | NASA POWER, GPM IMERG, Open-Meteo |
| **Clima** | `clima` | Reporte meteorológico convencional: temperatura, sensación térmica, condiciones actuales, pronóstico a 7 días y racha seca. | Open-Meteo |
| **Sismología** | `sismologia` | Epicentros en vivo e históricos, con exposición sísmica por distancia. | USGS, Servicio Geológico Colombiano |
| **Riesgo compuesto** | `riesgo-compuesto` | Combina los cinco modelos propios en una sola evaluación por vereda (gobierna el nivel más alto). | Modelos internos |

Todas las capas cubren Sevilla y Caicedonia; Precipitación y Clima extienden el mismo detalle a Zarzal y Roldanillo.

## Arquitectura

- **Framework:** Next.js (App Router) con React 19 y TypeScript.
- **Mapas:** Leaflet + react-leaflet, con capas GeoJSON y teselas vectoriales.
- **Datos:** rutas de API en `app/api/*` que consultan servicios externos y un backend QGIS, con revalidación y caché por capa. La obtención de datos en cliente usa SWR.
- **Gráficas:** Recharts mediante los componentes de gráfico de shadcn/ui.
- **Estilos:** Tailwind CSS v4 con tokens de diseño semánticos en `app/globals.css` y soporte de tema claro/oscuro.

### Estructura del proyecto

```
app/            Rutas, páginas y endpoints de API (App Router)
components/     Mapas (components/maps) y paneles del espacio de trabajo (components/home)
lib/            Clientes de datos y lógica por dominio (lib/<amenaza>)
public/         Imágenes de las teselas y recursos estáticos
```

Cada amenaza sigue el mismo patrón: un cliente de datos y un ensamblador por servidor en `lib/<amenaza>/`, un endpoint en `app/api/<amenaza>/`, un mapa en `components/maps/` y un panel en `components/home/`. El listado central de modelos vive en `lib/maps.ts`; añadir una entrada allí registra automáticamente el slug en la página principal.

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

Las fuentes keyless (Open-Meteo, GEOGLOWS, USGS) no requieren configuración adicional.

## Fuentes de datos

Vigía integra datos públicos de NASA POWER, GPM IMERG, NASA FIRMS (VIIRS), Open-Meteo, GEOGLOWS, USGS, el Servicio Geológico Colombiano y un backend QGIS con la cartografía de amenaza local. Los datos meteorológicos y de pronóstico provienen de modelos numéricos, no de observación directa, y se presentan como apoyo a la prevención, no como pronóstico oficial.

## Licencia

Proyecto de código abierto. Consulta el archivo de licencia del repositorio para los términos de uso.
