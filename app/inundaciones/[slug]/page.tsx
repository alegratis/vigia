import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, MapPin } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { StationDetail } from "@/components/flood/station-detail"
import { STATIONS, getStationBySlug } from "@/lib/geoglows/stations"

export function generateStaticParams() {
  return STATIONS.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const station = getStationBySlug(slug)
  if (!station) return { title: "Estación no encontrada — Vigía" }
  return {
    title: `${station.name} — Vigía`,
    description: `Pronóstico de inundaciones para ${station.river} en ${station.municipality}, ${station.department}.`,
  }
}

export default async function StationPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const station = getStationBySlug(slug)

  if (!station) {
    notFound()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <Link
          href="/inundaciones"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al pronóstico
        </Link>

        <div className="mb-8 flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">{station.river}</span>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {station.name}
          </h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {station.municipality}, {station.department}
            </span>
            <span className="tabular-nums">
              {station.lat.toFixed(4)}, {station.lon.toFixed(4)}
            </span>
            <span className="tabular-nums">Tramo GEOGLOWS #{station.reachId}</span>
          </p>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            {station.note}
          </p>
        </div>

        <StationDetail reachId={station.reachId} />
      </main>

      <SiteFooter />
    </div>
  )
}
