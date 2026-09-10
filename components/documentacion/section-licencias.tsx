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
      <h2 className="text-2xl font-semibold tracking-tight">Licencias de código abierto</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        Vigía es un proyecto de código abierto, creado por Alejandro Pino y publicado bajo la
        licencia MIT. Las dependencias de código que trae la app se listan a continuación,
        agrupadas por su propia licencia, tal como la declara cada paquete.
      </p>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Licencia del proyecto</CardTitle>
            <Badge variant="outline">MIT</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Creado por Alejandro Pino. El código de Vigía se distribuye bajo la licencia MIT: cualquiera
            puede usarlo, copiarlo, modificarlo y redistribuirlo, incluso con fines comerciales, siempre
            que conserve el aviso de copyright original. Se ofrece &quot;tal cual&quot;, sin garantía. El
            texto completo está en el archivo{" "}
            <span className="font-mono text-xs sm:text-sm">LICENSE</span> en la raíz del repositorio.
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
