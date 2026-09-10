import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface LicenseGroup {
  license: string
  packages: string[]
}

// Read directly from each package's own package.json (node_modules/<pkg>/package.json)
// at the time of writing — not a claim maintained by hand elsewhere.
const LICENSE_GROUPS: LicenseGroup[] = [
  {
    license: "MIT",
    packages: [
      "next",
      "react",
      "react-dom",
      "next-themes",
      "@base-ui/react",
      "@terraformer/arcgis",
      "@turf/boolean-point-in-polygon",
      "@turf/helpers",
      "class-variance-authority (Apache-2.0, ver abajo)",
      "clsx",
      "cn",
      "html2canvas-pro",
      "jspdf",
      "lucide-react (ISC, ver abajo)",
      "recharts",
      "shadcn",
      "swr",
      "tailwind-merge",
      "tw-animate-css",
      "tailwindcss",
      "@tailwindcss/postcss",
      "postcss",
      "@types/leaflet, @types/node, @types/react, @types/react-dom",
    ],
  },
  {
    license: "BSD-2-Clause",
    packages: ["leaflet"],
  },
  {
    license: "BSD-3-Clause",
    packages: ["@mapbox/vector-tile", "pbf"],
  },
  {
    license: "Apache-2.0",
    packages: ["class-variance-authority", "typescript"],
  },
  {
    license: "ISC",
    packages: ["lucide-react"],
  },
  {
    license: "MPL-2.0",
    packages: ["@vercel/analytics"],
  },
  {
    license: "Hippocratic-2.1",
    packages: ["react-leaflet"],
  },
]

export function SectionLicencias() {
  return (
    <section id="licencias" className="flex flex-col gap-4 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">Licencia y uso del código</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        El repositorio de Vigía es público para que cualquiera pueda leer su código, auditarlo y
        aprender de él, creado por Alejandro Pino (SIG &middot; Director Técnico). La plataforma en
        sí — el sitio que estás usando — es de uso público y gratuito. El código fuente, en
        cambio, todavía no tiene una licencia de código abierto: las dependencias que trae la app
        sí la tienen y se listan a continuación, agrupadas por su propia licencia.
      </p>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Licencia del proyecto</CardTitle>
            <Badge variant="outline">Todos los derechos reservados</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Creado por Alejandro Pino, SIG &middot; Director Técnico (
            <a href="mailto:apino@redlabot.org" className="text-primary hover:underline">
              apino@redlabot.org
            </a>
            ). El repositorio de Vigía es público para consulta y auditoría, pero el código fuente
            no está bajo una licencia de código abierto: por ahora no se permite usarlo, copiarlo,
            modificarlo o redistribuirlo sin permiso escrito del autor, mientras se termina de
            definir y estabilizar su funcionalidad. La{" "}
            <span className="text-foreground">plataforma</span> (la aplicación desplegada que ves
            en este sitio) sí es de uso público y gratuito. El texto completo está en el archivo{" "}
            <span className="font-mono text-xs sm:text-sm">LICENSE</span> en la raíz del
            repositorio, e incluye la intención de publicar el código bajo una licencia de código
            abierto (por ejemplo, MIT) una vez alcance mayor estabilidad.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LICENSE_GROUPS.map((group) => (
          <Card key={group.license}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{group.license}</CardTitle>
                <Badge variant="outline">{group.packages.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm leading-relaxed text-muted-foreground">
                {group.packages.map((pkg) => (
                  <li key={pkg} className="font-mono text-xs sm:text-sm">
                    {pkg}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Licencias de los datos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">OpenStreetMap</span> — Open Database
              License (ODbL). Todo uso debe atribuir a{" "}
              <span className="text-foreground">&copy; colaboradores de OpenStreetMap</span>.
            </li>
            <li>
              <span className="font-medium text-foreground">NASA (FIRMS, GIBS)</span> — datos
              públicos financiados con fondos federales de EE. UU., de libre uso y redistribución.
            </li>
            <li>
              <span className="font-medium text-foreground">Copernicus (GWIS/EFFIS)</span> — bajo
              la política de datos gratuitos, plenos y abiertos del programa Copernicus de la
              Unión Europea.
            </li>
            <li>
              <span className="font-medium text-foreground">DANE y Esri Colombia</span> — datos
              abiertos publicados por el Estado colombiano y su red de datos abiertos.
            </li>
            <li>
              <span className="font-medium text-foreground">GEOGLOWS (ECMWF)</span> — acceso
              abierto a través de su API pública v2.
            </li>
            <li>
              <span className="font-medium text-foreground">RED LabOT</span> — índices de
              susceptibilidad publicados abiertamente en ArcGIS Online; ver{" "}
              <a href="https://redlabot.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                redlabot.org
              </a>{" "}
              para sus términos de atribución.
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
