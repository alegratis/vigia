const REFERENCIAS = [
  "Luhmann, N. (1993). Risk: A Sociological Theory. Walter de Gruyter.",
  "Wisner, B., Blaikie, P., Cannon, T. y Davis, I. (2004). At Risk: Natural Hazards, People's Vulnerability and Disasters (2.ª ed.). Routledge.",
  "Maskovsky, J. (2001). Beyond Disaster Relief: Toward an Anthropology of Emergency. Journal of Latin American and Caribbean Anthropology.",
]

const PRIORIDADES = [
  {
    titulo: "Municipios con IVS combinado alto",
    texto:
      "Donde el IVS coincide con un riesgo compuesto alto o muy alto: inversión pública extraordinaria en infraestructura básica, mejoramiento integral de vivienda y regularización de tenencia de la tierra — antes que reasentamiento forzoso.",
  },
  {
    titulo: "Control urbano preventivo",
    texto:
      "En manzanas o veredas donde la exposición física ya es alta, restringir nuevos asentamientos sin infraestructura adecuada y exigir estándares de construcción realistas para la capacidad económica local.",
  },
  {
    titulo: "Universalización de servicios",
    texto:
      "Acueducto y alcantarillado como derecho, no como mercancía — es la dimensión con mayor peso individual (25%) en el IVS precisamente porque su ausencia es la más directamente atribuible a decisión pública, no a geografía.",
  },
  {
    titulo: "Cobertura educativa y dependencia económica",
    texto:
      "Donde Educación o Trabajo dominan el IVS de un municipio, la respuesta no es un mapa: es transporte escolar subsidiado y programas de formalización laboral — el dato solo señala dónde falta esa inversión.",
  },
]

/**
 * Condensed Spanish adaptation of the conceptual brief's Part 4 (theoretical
 * framework), rewritten around this app's actual IVS (4 dimensions, 4
 * municipios) instead of a generic 5-dimension SVI, and trimmed of features
 * this app doesn't have (a /demografia/framework route, RED LabOT contact
 * directory, social-share buttons) per the plan's explicit scope.
 */
export function SectionMarcoTeorico() {
  return (
    <section id="marco-teorico" className="flex flex-col gap-4 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">Marco teórico</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        De la "gestión del riesgo" a la transformación estructural. Esta sección explica por qué el
        panel de Demografía habla de vulnerabilidad social en vez de desastres naturales, y qué
        implica esa diferencia para leer el Índice de Vulnerabilidad Social (IVS) que calcula esta
        plataforma.
      </p>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-foreground">
          1. Crítica a la categoría "desastre natural"
        </h3>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          La categoría "desastre natural" naturaliza lo que en realidad es producto histórico —
          presenta como inevitable una pérdida que resulta de decisiones concretas sobre dónde se
          permite construir, qué vivienda se ofrece a quién y qué servicios públicos se mantienen
          durante décadas. También individualiza la responsabilidad: culpa a quien "vive en un
          lugar peligroso" en vez de preguntar por qué vive ahí. Esta plataforma no predice
          desastres naturales porque, en ese sentido, no existen: existen fenómenos naturales —una
          crecida, un sismo, un deslizamiento— y existen condiciones sociales previas que convierten
          ese fenómeno en catástrofe para una población específica y no para otra.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-foreground">
          2. Riesgo como decisión, no como fenómeno
        </h3>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          La teoría de sistemas de Niklas Luhmann distingue riesgo de peligro: el riesgo es
          contingencia atribuible a una decisión; el peligro es contingencia del entorno. Quien
          "decide" producir el daño no es la crecida ni el sismo, sino quienes permiten
          asentamientos en zonas expuestas sin infraestructura adecuada, no garantizan vivienda
          digna para la población de menores ingresos, o mantienen servicios públicos precarios
          durante años. Un IVS alto en Sevilla, Caicedonia, Zarzal o Roldanillo no describe un
          "riesgo natural" de ese lugar: describe el resultado acumulado de decisiones (o de su
          ausencia) sobre ese lugar.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-foreground">
          3. Vulnerabilidad como relación social, no como atributo
        </h3>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          La vulnerabilidad no es un atributo inherente de una persona o de un lugar: resulta de
          relaciones de producción que concentran la tierra buena en pocas manos y empujan a otros
          hacia laderas inestables, que mercantilizan la vivienda hasta volver inaccesible el suelo
          seguro, y que precarizan el trabajo hasta volver imposible invertir en mejorar una casa.
          Un mismo aguacero (tesis) sobre una misma ladera no produce el mismo resultado en dos
          hogares con vulnerabilidad social distinta (antítesis) — lo que llamamos "desastre" es esa
          exposición diferencial a la pérdida, no una síntesis natural.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-foreground">4. Qué implica esto para decidir</h3>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          El IVS por sí solo no prioriza nada — cruzado con el riesgo físico compuesto que ya calcula
          esta plataforma, sí señala dónde invertir primero. Cuatro frentes concretos, en orden
          decreciente de urgencia cuando el IVS y el riesgo físico coinciden en un mismo lugar:
        </p>
        <ul className="flex flex-col gap-3 pl-1">
          {PRIORIDADES.map((p) => (
            <li key={p.titulo} className="text-pretty leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{p.titulo}.</span> {p.texto}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-foreground">5. Límites de este índice</h3>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Ningún índice cuantitativo captura la totalidad de una experiencia vivida. Los datos del
          IVS provienen del Censo Nacional de Población y Vivienda 2018 del DANE — tienen un rezago
          de varios años y no incluyen la dimensión de Salud, que esta plataforma excluye
          explícitamente en vez de inventarla, por falta de un dato municipal 2018 confiable para
          estos 4 municipios (ver la explicación completa en el panel de Demografía). Georeferenciar
          la vulnerabilidad puede estigmatizar un territorio si se usa sin este contexto. El
          compromiso de esta plataforma es que el dato se use para exigir transformación de
          condiciones, no para etiquetar poblaciones como "en riesgo" — la vulnerabilidad mide
          ausencia de derechos, no ausencia de capacidad humana.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Referencias teóricas
        </p>
        <ul className="flex flex-col gap-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
          {REFERENCIAS.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
