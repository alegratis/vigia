import { ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface DataSource {
  nombre: string
  publicador: string
  descripcion: string
  url: string
  acceso: string
  licencia: string
  cobertura: string
  actualizacion: string
}

/**
 * One data-source entry in the "Fuentes de datos" section: name/publisher,
 * a short description of what the app pulls from it, and a footer grid of
 * access/license/coverage/update-cadence facts pulled straight from each
 * lib/**\/client.ts module's own doc comments, so this stays a faithful
 * mirror of what the code actually does rather than a separate claim to
 * keep in sync by hand.
 */
export function DataSourceCard({ source }: { source: DataSource }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{source.nombre}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{source.publicador}</p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {source.acceso}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{source.descripcion}</p>
        <dl className="grid grid-cols-1 gap-2 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="font-medium text-foreground">Cobertura</dt>
            <dd className="mt-0.5 text-muted-foreground">{source.cobertura}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Licencia / términos</dt>
            <dd className="mt-0.5 text-muted-foreground">{source.licencia}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Actualización</dt>
            <dd className="mt-0.5 text-muted-foreground">{source.actualizacion}</dd>
          </div>
        </dl>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Ver servicio
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
      </CardContent>
    </Card>
  )
}
