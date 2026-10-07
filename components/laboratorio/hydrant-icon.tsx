import type { SVGProps } from "react"

/**
 * Lucide has no fire-hydrant glyph, so this one is drawn on the same 24px grid
 * with the same 2px rounded stroke to sit alongside the other rail icons.
 */
export function HydrantIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 8V7a4 4 0 0 1 8 0v1" />
      <path d="M7 8h10" />
      <path d="M9 8v12" />
      <path d="M15 8v12" />
      <path d="M9 11.5H5.5a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5H9" />
      <path d="M15 11.5h3.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H15" />
      <path d="M7 20h10" />
    </svg>
  )
}
