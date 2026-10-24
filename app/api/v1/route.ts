import { ok, preflight } from "@/lib/api/v1"

export const OPTIONS = preflight

export async function GET() {
  return ok(
    {
      nombre: "API pública de Vigía",
      version: "v1",
      especificacion: "/api/v1/openapi.json",
      recursos: {
        veredas: "/api/v1/veredas",
        vereda: "/api/v1/veredas/{codigoVereda}",
        riesgo: "/api/v1/riesgo",
        alertas: "/api/v1/alertas",
        sismos: "/api/v1/sismos",
      },
    },
    { cacheSeconds: 3600 },
  )
}
