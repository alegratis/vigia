import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Turns a design token into a usable CSS color: accepts both `var(--x)` and a bare `x` name. */
export function tokenColor(token: string): string {
  return token.startsWith("var(") ? token : `var(--${token})`
}
