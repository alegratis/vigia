import { cn } from '@/lib/utils'

export const PORTFOLIO_URL = 'https://sig.alejandro-pino.com'

export function AlejandroPinoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block size-8 shrink-0 bg-current', className)}
      style={{
        maskImage: 'url(/brand/alejandro-pino-mark.svg)',
        WebkitMaskImage: 'url(/brand/alejandro-pino-mark.svg)',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}

type LockupProps = {
  className?: string
  textClassName?: string
  srLabel?: string
  linked?: boolean
}

export function AlejandroPinoLockup({
  className,
  textClassName,
  srLabel = 'Alejandro Pino, SIG - desarrollo, ir a sig.alejandro-pino.com (se abre en una pestaña nueva)',
  linked = true,
}: LockupProps) {
  const content = (
    <>
      <AlejandroPinoMark />
      <span className="sr-only">{srLabel}</span>
      <span aria-hidden="true" className={cn('font-brand flex-col items-start gap-[3px]', textClassName ?? 'flex')}>
        <span className="text-sm font-semibold leading-none tracking-wide">ALEJANDRO PINO</span>
        <span className="whitespace-nowrap text-[10px] font-medium leading-none tracking-[0.2em] opacity-70">
          SIG - DESARROLLO
        </span>
      </span>
    </>
  )

  if (!linked) {
    return <span className={cn('flex min-h-11 items-center gap-2', className)}>{content}</span>
  }

  return (
    <a
      href={PORTFOLIO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {content}
    </a>
  )
}
