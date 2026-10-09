const LAYER_SLUGS = "deslizamientos|inundaciones|incendios|precipitacion|clima|sismologia|riesgo-compuesto|demografia"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: "/laboratorio", destination: "/", permanent: true },
      { source: `/:slug(${LAYER_SLUGS})`, destination: "/?layers=:slug", permanent: true },
      { source: `/maps/:slug(${LAYER_SLUGS})`, destination: "/?layers=:slug", permanent: true },
      { source: "/inundaciones/:slug", destination: "/?layers=inundaciones", permanent: true },
    ]
  },
}

export default nextConfig
