export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>Designed &amp; built by the Cartograph team.</p>
        <p>&copy; {year} Cartograph. All rights reserved.</p>
      </div>
    </footer>
  )
}
