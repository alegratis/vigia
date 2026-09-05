export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-sm text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
        <p>Proyecto de código abierto &middot; Datos de GEOGLOWS y NASA FIRMS.</p>
        <p>&copy; {year} Vigía. Publicado bajo licencia de código abierto.</p>
      </div>
    </footer>
  )
}
