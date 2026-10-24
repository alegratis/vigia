import { CodeBlock } from "@/components/documentacion/api/code-block"
import { InlineCode } from "@/components/documentacion/api/inline-code"
import type { ApiEndpoint } from "@/components/documentacion/api/endpoints-data"

export function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  return (
    <article className="flex flex-col gap-4 border-b border-border pb-8 last:border-b-0 last:pb-0">
      <header className="flex flex-col gap-2">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{endpoint.summary}</h3>
        <p className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-primary px-2 py-0.5 font-mono text-xs font-semibold text-primary-foreground">
            GET
          </span>
          <code className="break-all font-mono text-sm text-foreground">{endpoint.path}</code>
        </p>
        {endpoint.description ? (
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{endpoint.description}</p>
        ) : null}
      </header>

      {endpoint.params.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">{`Parámetros de ${endpoint.path}`}</caption>
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Parámetro</th>
                <th scope="col" className="px-3 py-2 font-medium">Dónde</th>
                <th scope="col" className="px-3 py-2 font-medium">Tipo</th>
                <th scope="col" className="px-3 py-2 font-medium">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {endpoint.params.map((param) => (
                <tr key={param.name} className="border-b border-border align-top last:border-b-0">
                  <td className="px-3 py-2">
                    <InlineCode>{param.name}</InlineCode>
                    {param.required ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">obligatorio</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{param.location}</td>
                  <td className="px-3 py-2 text-muted-foreground">{param.type}</td>
                  <td className="px-3 py-2 text-pretty leading-relaxed text-muted-foreground">
                    {param.description}
                    {param.defaultValue ? (
                      <>
                        {" "}Por defecto: <InlineCode>{param.defaultValue}</InlineCode>.
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <CodeBlock label="Petición" code={endpoint.example} />
      <CodeBlock label={endpoint.responseLabel} code={endpoint.response} />

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-foreground">Frescura de los datos:</dt>
          <dd className="text-muted-foreground">hasta {endpoint.freshness} de antigüedad.</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-medium text-foreground">Errores específicos:</dt>
          <dd>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              {endpoint.errors.map((error) => (
                <li key={error} className="text-pretty">
                  {error}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </article>
  )
}
