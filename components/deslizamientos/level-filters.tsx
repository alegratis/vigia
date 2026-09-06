"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { SUSCEPTIBILITY_LEVELS, SUSCEPTIBILITY_LEVEL_STYLES, type SusceptibilityLevel } from "@/lib/deslizamientos/levels"

interface LevelFiltersProps {
  selectedLevels: SusceptibilityLevel[]
  onSelectedLevelsChange: (levels: SusceptibilityLevel[]) => void
  className?: string
}

/**
 * "Nivel de susceptibilidad" checkbox filter for the deslizamientos
 * population panel. An empty selection means "no filter" — every level is
 * included — matching the reference ArcGIS dashboard's default state.
 */
export function LevelFilters({ selectedLevels, onSelectedLevelsChange, className }: LevelFiltersProps) {
  function toggleLevel(level: SusceptibilityLevel, checked: boolean) {
    if (checked) {
      onSelectedLevelsChange([...selectedLevels, level])
    } else {
      onSelectedLevelsChange(selectedLevels.filter((l) => l !== level))
    }
  }

  return (
    <fieldset className={className}>
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Nivel de susceptibilidad
      </legend>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {SUSCEPTIBILITY_LEVELS.map((level) => {
          const checked = selectedLevels.includes(level)
          const style = SUSCEPTIBILITY_LEVEL_STYLES[level]
          return (
            <div
              key={level}
              className="flex min-h-10 items-center gap-2 rounded-md border px-2.5 transition-colors"
              style={
                checked
                  ? {
                      borderColor: style.colorToken,
                      backgroundColor: `color-mix(in oklab, ${style.colorToken} 18%, transparent)`,
                    }
                  : { borderColor: "var(--border)" }
              }
            >
              <Checkbox
                id={`deslizamientos-level-${level}`}
                checked={checked}
                onCheckedChange={(value) => toggleLevel(level, value === true)}
              />
              <Label
                htmlFor={`deslizamientos-level-${level}`}
                className="flex flex-1 items-center gap-1.5 text-sm font-medium"
                style={{ color: checked ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: style.colorToken }}
                  aria-hidden="true"
                />
                {level}
              </Label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
