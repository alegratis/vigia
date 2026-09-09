const SECTIONS = [
  { id: "resumen", label: "Resumen" },
  { id: "uso", label: "Guía de uso" },
  { id: "funcionalidades", label: "Funcionalidades" },
  { id: "fuentes", label: "Fuentes de datos" },
  { id: "metodologia", label: "Metodología del modelo de amenaza" },
  { id: "arquitectura", label: "Arquitectura" },
  { id: "licencias", label: "Licencias de código abierto" },
]

/**
 * Plain anchor-link table of contents — no scroll-spy JS, just native
 * fragment navigation, since this is a static reference document rather
 * than an app view that needs to track scroll state.
 */
export function DocToc() {
  return (
    <nav aria-label="Tabla de contenido" className="lg:sticky lg:top-24">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">En esta página</p>
      <ul className="flex flex-col gap-1 border-l border-border pl-3 text-sm">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="block rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
