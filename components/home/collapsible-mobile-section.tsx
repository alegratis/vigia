import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface CollapsibleMobileSectionProps {
  title: string
  children: React.ReactNode
}

/**
 * Wraps secondary panel content — source captions, methodology asides —
 * that's useful but not essential to glance at immediately. On mobile
 * (`lg:hidden`), it collapses behind an accordion trigger so this text
 * doesn't compete with the graphs and map data above it for scroll space.
 * On desktop (`hidden lg:block`), the exact same children render directly,
 * always visible and unwrapped — desktop's below-the-fold layout is
 * untouched by this component.
 */
export function CollapsibleMobileSection({ title, children }: CollapsibleMobileSectionProps) {
  return (
    <>
      <div className="lg:hidden">
        <Accordion>
          <AccordionItem value="section" className="border-none">
            <AccordionTrigger className="text-sm font-medium text-foreground">{title}</AccordionTrigger>
            <AccordionContent>{children}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <div className="hidden lg:block">{children}</div>
    </>
  )
}
