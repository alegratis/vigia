import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getMapModel, mapModels } from "@/lib/maps"

export function generateStaticParams() {
  return mapModels.map((model) => ({ slug: model.slug }))
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const model = getMapModel(slug)

  if (!model) {
    notFound()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a los modelos
        </Link>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">{model.tag}</span>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {model.title}
            </h1>
            <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              {model.description}
            </p>
          </div>

          <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border">
            <Image
              src={model.image || "/placeholder.svg"}
              alt={model.imageAlt}
              fill
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="object-cover"
              priority
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Aquí aparecerán los controles de la interfaz de este modelo.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
