import { LAYER_DEFINITIONS, type LayerKey } from "@/lib/laboratorio/layers"
import { LAYER_METHODOLOGY, type MethodSection } from "@/lib/laboratorio/methodology"

function Section({ section }: { section: MethodSection }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
      {section.intro && <p className="text-sm leading-relaxed text-muted-foreground">{section.intro}</p>}
      {section.factors && (
        <dl className="flex flex-col divide-y divide-border rounded-md border border-border">
          {section.factors.map((factor) => (
            <div key={factor.name} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="flex shrink-0 items-baseline gap-2 text-sm font-medium text-foreground sm:w-56">
                <span>{factor.name}</span>
                {factor.weight && (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {factor.weight}
                  </span>
                )}
              </dt>
              {factor.detail && (
                <dd className="text-sm leading-relaxed text-muted-foreground">{factor.detail}</dd>
              )}
            </div>
          ))}
        </dl>
      )}
      {section.bullets && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-border">
          {section.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function LayerMethodology({ layer }: { layer: LayerKey }) {
  const content = LAYER_METHODOLOGY[layer]

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-5" aria-label={`Metodología de ${LAYER_DEFINITIONS[layer].label}`}>
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">{LAYER_DEFINITIONS[layer].label}</h3>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{content.summary}</p>
      </header>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-foreground">Flujo de datos</h4>
          <ol className="flex flex-col gap-2">
            {content.flow.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-foreground"
                >
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-foreground">Fuentes</h4>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-border">
            {content.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </section>
      </div>

      {content.sections.map((section) => (
        <Section key={section.title} section={section} />
      ))}

      <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
        <h4 className="text-sm font-semibold text-foreground">Limitaciones</h4>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-border">
          {content.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>
    </article>
  )
}
