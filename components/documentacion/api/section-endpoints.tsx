import { EndpointCard } from "@/components/documentacion/api/endpoint-card"
import { API_GROUPS } from "@/components/documentacion/api/endpoints-data"

export function SectionApiEndpoints() {
  return (
    <>
      {API_GROUPS.map((group) => (
        <section key={group.id} id={group.id} className="flex scroll-mt-24 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{group.title}</h2>
            <p className="text-pretty leading-relaxed text-muted-foreground">{group.intro}</p>
          </div>
          <div className="flex flex-col gap-8">
            {group.endpoints.map((endpoint) => (
              <EndpointCard key={endpoint.path} endpoint={endpoint} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
