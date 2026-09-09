import { DataSourceCard, type DataSource } from "./data-source-card"

interface SourceGroup {
  title: string
  description: string
  sources: DataSource[]
}

const GROUPS: SourceGroup[] = [
  {
    title: "Índices de amenaza",
    description:
      "Capas estáticas publicadas en ArcGIS Online por RED LabOT y la Secretaría de Infraestructura del Valle del Cauca — abiertas, sin autenticación.",
    sources: [
      {
        nombre: "Índice de susceptibilidad a deslizamientos",
        publicador: "RED LabOT",
        descripcion:
          "~11.721 puntos con nivel de susceptibilidad, puntaje y conteos de población y de infraestructura crítica (escuelas, hospitales, farmacias) por punto. Ya no colorea el mapa de deslizamientos (ver el modelo propio, abajo); sigue siendo la fuente de los conteos de población e infraestructura del panel de exposición por nivel de amenaza. Cubre Sevilla y Caicedonia; Zarzal no tiene registros por estar en el valle plano.",
        url: "https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services/VIGIA_Amenaza_IS_Puntos/FeatureServer",
        acceso: "ArcGIS FeatureServer",
        licencia: "Datos abiertos, sin autenticación",
        cobertura: "Sevilla, Caicedonia",
        actualizacion: "Capa estática; la app la relee cada hora",
      },
      {
        nombre: "Modelo propio de amenaza por deslizamiento",
        publicador: "Vigía (cálculo propio, inspirado en NASA LHASA v1)",
        descripcion:
          "Combina pendiente del terreno (DEM Copernicus GLO-30, vía la API de elevación de Open-Meteo), distancia a la vía más cercana (red vial de OpenStreetMap/Overpass), distancia a la falla geológica más próxima (capa del SGC, ver la ficha siguiente) y una anomalía de lluvia reciente frente a su propia línea base histórica de 3 años (archivo histórico de Open-Meteo), calculado en el centroide de cada vereda. Reemplaza al índice de RED LabOT como fuente del color del mapa de deslizamientos — es un modelo propio de esta app, no un índice oficial publicado, pero documentado y con sus factores visibles en el popup de cada vereda. Ver la sección \"Metodología\" más abajo para el detalle completo, paso a paso, de cómo se calcula.",
        url: "https://open-meteo.com/en/docs/elevation-api",
        acceso: "Cálculo propio sobre APIs REST abiertas",
        licencia: "N/A — calculado por la app a partir de fuentes abiertas",
        cobertura: "Sevilla, Caicedonia, Zarzal (~55 centroides de vereda)",
        actualizacion: "Pendiente y vías cambian poco (cache de 30 días y 6 horas); lluvia recalculada cada hora",
      },
      {
        nombre: "Fallas geológicas — Atlas Geológico de Colombia",
        publicador: "Servicio Geológico Colombiano (SGC)",
        descripcion:
          "37 trazas de falla (tipo y nombre, p. ej. \"Falla de Cauca-Almaguer\") que intersectan el área de estudio. Usada dos veces: como cuarto factor del modelo propio de amenaza (distancia real punto-a-segmento hasta la traza más próxima, 30% del factor estático) y como capa opcional independiente en el mapa (\"Fallas geológicas (SGC)\"), mostrada como líneas discontinuas con su tipo y nombre en el popup. Encontrada a partir de un enlace compartido por el equipo a datos.sgc.gov.co.",
        url: "https://services1.arcgis.com/Og2nrTKe5bptW02d/arcgis/rest/services/Fallas/FeatureServer/0",
        acceso: "ArcGIS FeatureServer",
        licencia: "Datos abiertos, sin autenticación",
        cobertura: "Nacional (recortada al área de estudio)",
        actualizacion: "Cartografía geológica estática; la app la relee cada 30 días",
      },
      {
        nombre: "Amenaza por incendios forestales",
        publicador: "RED LabOT",
        descripcion: "Polígonos de amenaza por incendio forestal, por vereda rural.",
        url: "https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services/AmenazaIncendios/FeatureServer",
        acceso: "ArcGIS FeatureServer",
        licencia: "Datos abiertos, sin autenticación",
        cobertura: "Sevilla, Caicedonia",
        actualizacion: "Capa estática; la app la relee cada hora",
      },
      {
        nombre: "Susceptibilidad a inundaciones",
        publicador: "RED LabOT",
        descripcion: "Polígonos de zonificación estática de susceptibilidad a inundación.",
        url: "https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services/susceptibilidad_inundaciones/FeatureServer",
        acceso: "ArcGIS FeatureServer",
        licencia: "Datos abiertos, sin autenticación",
        cobertura: "Sevilla, Caicedonia",
        actualizacion: "Capa estática; la app la relee cada hora",
      },
      {
        nombre: "Sitios críticos (daño vial)",
        publicador: "Secretaría de Infraestructura del Valle del Cauca",
        descripcion:
          "94 puntos de daño vial relevados en campo en un único levantamiento (2019-07-15) — información histórica de sitios conocidos, no un monitoreo en vivo.",
        url: "https://infraestructura.valledelcauca.gov.co/server/rest/services",
        acceso: "ArcGIS Server (REST)",
        licencia: "Datos abiertos, sin autenticación",
        cobertura: "Sevilla, Caicedonia, Zarzal",
        actualizacion: "Levantamiento único; releído cada 24 h",
      },
    ],
  },
  {
    title: "Pronósticos y monitoreo en vivo",
    description: "Servicios internacionales gratuitos de agencias científicas y ambientales, sin necesidad de clave salvo donde se indica.",
    sources: [
      {
        nombre: "Pronóstico de caudal fluvial",
        publicador: "GEOGLOWS v2 (ECMWF)",
        descripcion:
          "Pronóstico determinístico de caudal por tramo de río, evaluado contra períodos de retorno calculados con el registro retrospectivo histórico del mismo tramo.",
        url: "https://geoglows.ecmwf.int/api/v2/",
        acceso: "API REST (JSON)",
        licencia: "Acceso abierto",
        cobertura: "Red fluvial global (recortada al área de estudio)",
        actualizacion: "Pronóstico diario; retrospectivo semanal",
      },
      {
        nombre: "Detecciones activas de incendio (VIIRS)",
        publicador: "NASA FIRMS (LANCE, EOSDIS)",
        descripcion: "Focos de calor casi en tiempo real detectados por los satélites VIIRS (Suomi NPP y NOAA-20/21).",
        url: "https://firms.modaps.eosdis.nasa.gov/api/",
        acceso: "API CSV (requiere clave gratuita)",
        licencia: "Datos públicos de la NASA",
        cobertura: "Global (recortada al área de estudio)",
        actualizacion: "Varias veces al día; la app cachea 15 min",
      },
      {
        nombre: "Humedad del suelo de raíz (SMAP L4)",
        publicador: "NASA GIBS (EOSDIS)",
        descripcion: "Mosaico de teselas WMTS de humedad del suelo, usado como pronóstico complementario en el mapa de deslizamientos.",
        url: "https://worldview.earthdata.nasa.gov/",
        acceso: "WMTS (teselas de imagen)",
        licencia: "Datos públicos de la NASA",
        cobertura: "Global",
        actualizacion: "Compuesto continuo, ~3–4 días de latencia",
      },
      {
        nombre: "Tasa de precipitación (GPM IMERG)",
        publicador: "NASA GIBS (EOSDIS)",
        descripcion: "Mosaico de teselas WMTS de precipitación de 2 km, usado como capa satelital en los mapas de inundaciones y precipitación.",
        url: "https://worldview.earthdata.nasa.gov/",
        acceso: "WMTS (teselas de imagen)",
        licencia: "Datos públicos de la NASA",
        cobertura: "Global",
        actualizacion: "Cada ~30 minutos",
      },
      {
        nombre: "Lluvia acumulada por punto (PRECTOTCORR)",
        publicador: "NASA POWER (LARC)",
        descripcion:
          "Precipitación diaria puntual por reanálisis MERRA-2 (datos asentados) o GEOS-IT (últimos días, casi en tiempo real) — no es GPM/satelital directo. Consultada una vez por centroide de vereda para el acumulado de 7 días del mapa de precipitación.",
        url: "https://power.larc.nasa.gov/",
        acceso: "API REST (JSON)",
        licencia: "Datos públicos de la NASA",
        cobertura: "Global (recortada al área de estudio)",
        actualizacion: "Diaria; la app cachea 3 horas",
      },
      {
        nombre: "Lluvia acumulada por estación automática",
        publicador: "IDEAM",
        descripcion:
          "Lecturas de precipitación cada 10 minutos de estaciones automáticas, expuestas en el portal de datos abiertos. Fuente alternativa (junto a NASA POWER) para el modo histórico del mapa de precipitación: más precisa donde hay estación cercana, pero solo 2 estaciones caen dentro de un radio de 20 km del área de estudio (Zarzal y Bugalagrande), sin cobertura en Caicedonia ni buena parte de Sevilla.",
        url: "https://www.datos.gov.co/resource/s54a-sgyg.json",
        acceso: "API REST (Socrata/JSON)",
        licencia: "Datos abiertos de Colombia (datos.gov.co)",
        cobertura: "2 estaciones dentro de 20 km del área de estudio",
        actualizacion: "Cada ~10 minutos; la app cachea 3 horas",
      },
      {
        nombre: "Lluvia mensual del año en curso (archivo histórico)",
        publicador: "Open-Meteo",
        descripcion:
          "Precipitación diaria por análisis ECMWF IFS HRES (últimos ~2 meses, asimila observaciones reales de estaciones y radiosondas) con reanálisis ERA5/ERA5-Land más atrás en el año — no es una lectura satelital directa. Usada para la línea de comparación del año en curso en el histograma de climatología, en lugar de NASA POWER: su capa casi en tiempo real (derivada de GPM IMERG) mostró sobrestimaciones notables de lluvia en este terreno montañoso durante las pruebas.",
        url: "https://open-meteo.com/en/docs/historical-weather-api",
        acceso: "API REST (JSON)",
        licencia: "Uso no comercial gratuito, sin clave",
        cobertura: "Global (recortada al área de estudio)",
        actualizacion: "Diaria, con ligero retraso en los días más recientes; la app cachea 1 hora",
      },
      {
        nombre: "Índice de riesgo de incendio (FWI)",
        publicador: "Copernicus GWIS / EFFIS (Comisión Europea, JRC)",
        descripcion: "Pronóstico diario del Índice Meteorológico de Incendio (Fire Weather Index), derivado de datos meteorológicos del ECMWF.",
        url: "https://maps.effis.emergency.copernicus.eu/gwis",
        acceso: "WMS",
        licencia: "Política de datos abiertos de Copernicus",
        cobertura: "Global",
        actualizacion: "Pronóstico diario, hasta 7 días",
      },
    ],
  },
  {
    title: "Demografía y límites administrativos",
    description: "Fuentes gubernamentales y de datos abiertos usadas para población, veredas y cascos urbanos.",
    sources: [
      {
        nombre: "Proyecciones de población municipal",
        publicador: "DANE",
        descripcion:
          "Proyecciones y retroproyecciones de población municipal 2018–2042 (modelo cohorte-componente post-censo 2018). Publicado solo como un libro de cálculo nacional de ~930 MB sin API por municipio, así que las filas de Sevilla, Caicedonia y Zarzal se extrajeron una vez y se versionan como JSON estático en el repositorio.",
        url: "https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion",
        acceso: "Descarga estática (Excel), extraída a JSON",
        licencia: "Datos abiertos del Estado colombiano",
        cobertura: "Sevilla, Caicedonia, Zarzal",
        actualizacion: "Última publicación: 2025-07-30; sin llamada de red en la app",
      },
      {
        nombre: "Zona urbana (cabeceras municipales)",
        publicador: "DANE — Marco Geoestadístico Nacional",
        descripcion:
          "Límites de la cabecera municipal de cada municipio, usados para el pseudo-vereda \"Casco Urbano\" del selector de exposición.",
        url: "https://portalgis.dane.gov.co/mparcgis/rest/services/Hosted/Serv_ZonaUrbana_MGN_2025/FeatureServer",
        acceso: "ArcGIS FeatureServer",
        licencia: "Datos abiertos del Estado colombiano",
        cobertura: "Sevilla, Caicedonia, Zarzal",
        actualizacion: "Límites administrativos estáticos; releído cada semana",
      },
      {
        nombre: "Veredas de Colombia",
        publicador: "Esri Colombia (Datos Abiertos)",
        descripcion: "Límites administrativos de las veredas rurales de cada municipio.",
        url: "https://datosabiertos-esri-colombia.opendata.arcgis.com/datasets/esri-colombia::veredas-de-colombia",
        acceso: "ArcGIS FeatureServer",
        licencia: "Datos abiertos, sin autenticación",
        cobertura: "Sevilla, Caicedonia, Zarzal",
        actualizacion: "Límites administrativos estáticos; releído cada semana",
      },
    ],
  },
  {
    title: "Infraestructura",
    description: "Puntos de interés comunitarios, con la misma filosofía de datos abiertos que el resto de la plataforma.",
    sources: [
      {
        nombre: "Puntos de interés (OSM)",
        publicador: "OpenStreetMap (API Overpass)",
        descripcion:
          "Comercios, oficinas, y equipamiento de salud, financiero, gubernamental y social, clasificados en cinco categorías para el desglose de \"Infraestructura por categoría\".",
        url: "https://wiki.openstreetmap.org/wiki/Overpass_API",
        acceso: "API Overpass (POST)",
        licencia: "Open Database License (ODbL) — © colaboradores de OpenStreetMap",
        cobertura: "Sevilla, Caicedonia, Zarzal",
        actualizacion: "Consultada cada 6 horas",
      },
    ],
  },
]

export function SectionFuentes() {
  return (
    <section id="fuentes" className="flex flex-col gap-6 scroll-mt-24">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Fuentes de datos</h2>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Vigía no tiene una base de datos propia: cada vista consulta directamente estos
          servicios públicos, en su mayoría abiertos y sin necesidad de autenticación.
        </p>
      </div>
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">{group.title}</h3>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{group.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {group.sources.map((source) => (
              <DataSourceCard key={source.nombre} source={source} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
