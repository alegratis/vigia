export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>Proyecto de código abierto &middot; Datos de GEOGLOWS y NASA FIRMS.</p>
        <p>&copy; {year} Vigía. Publicado bajo licencia de código abierto.</p>
      </div>
    </footer>
  )
}
