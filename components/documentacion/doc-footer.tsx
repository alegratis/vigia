import Image from "next/image"

export function DocFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <a
            href="https://redlabot.org"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Image
              src="/images/redlabot-lockup-light.png"
              alt="RED LabOT — Red de Laboratorios de Observación de la Tierra de las Américas, para la Inteligencia Territorial de las Américas"
              width={977}
              height={476}
              className="block h-16 w-auto dark:hidden"
            />
            <Image
              src="/images/redlabot-lockup-dark.png"
              alt="RED LabOT — Red de Laboratorios de Observación de la Tierra de las Américas, para la Inteligencia Territorial de las Américas"
              width={977}
              height={476}
              className="hidden h-16 w-auto dark:block"
            />
          </a>
          <a
            href="https://nasalifelines.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Image
              src="/images/nasa-lifelines-wordmark-darkblue.png"
              alt="NASA Lifelines"
              width={5112}
              height={643}
              className="block h-9 w-auto dark:hidden"
            />
            <Image
              src="/images/nasa-lifelines-wordmark-white.png"
              alt="NASA Lifelines"
              width={5112}
              height={643}
              className="hidden h-9 w-auto dark:block"
            />
          </a>
        </div>
        <p className="max-w-md text-pretty text-sm text-muted-foreground">
          Plataforma de uso público y gratuito &middot; Datos de RED LabOT, GEOGLOWS, NASA
          FIRMS/GIBS, Copernicus GWIS, DANE, Esri Colombia y OpenStreetMap.
        </p>
        <p className="text-sm text-muted-foreground">
          &copy; {year} Vigía. Creado por Alejandro Pino, SIG &middot; Director Técnico
          (
          <a href="mailto:apino@redlabot.org" className="text-primary hover:underline">
            apino@redlabot.org
          </a>
          ). Repositorio público, todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}
