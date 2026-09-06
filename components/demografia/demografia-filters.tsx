"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  AVAILABLE_YEARS,
  DEMOGRAFIA_CATEGORY_GROUPS,
  categoriesInGroup,
  type AvailableYear,
  type DemografiaCategoryKey,
} from "@/lib/demografia/categories"

interface DemografiaFiltersProps {
  year: AvailableYear
  onYearChange: (year: AvailableYear) => void
  selectedCategories: DemografiaCategoryKey[]
  onSelectedCategoriesChange: (categories: DemografiaCategoryKey[]) => void
  className?: string
}

/**
 * Shared "Panel de consulta" filter for the demographics section: year
 * selector plus urbano/rural/hombres/mujeres category checkboxes. Both the
 * overview page and the per-hazard map card use this so the two stay in
 * sync with the same DANE categories.
 */
export function DemografiaFilters({
  year,
  onYearChange,
  selectedCategories,
  onSelectedCategoriesChange,
  className,
}: DemografiaFiltersProps) {
  function toggleCategory(key: DemografiaCategoryKey, checked: boolean) {
    if (checked) {
      onSelectedCategoriesChange([...selectedCategories, key])
    } else {
      onSelectedCategoriesChange(selectedCategories.filter((c) => c !== key))
    }
  }

  return (
    <div className={className}>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Año
        </legend>
        <ToggleGroup
          value={[String(year)]}
          onValueChange={(value) => {
            const next = value[0]
            if (next) onYearChange(Number(next) as AvailableYear)
          }}
          variant="outline"
          className="flex-wrap justify-start"
        >
          {AVAILABLE_YEARS.map((y) => (
            <ToggleGroupItem key={y} value={String(y)} aria-label={`Año ${y}`}>
              {y}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <div className="mt-5 flex flex-col gap-5">
        {DEMOGRAFIA_CATEGORY_GROUPS.map((group) => (
          <fieldset key={group.key} className="flex flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {categoriesInGroup(group.key).map((category) => {
                const checked = selectedCategories.includes(category.key)
                return (
                  <div
                    key={category.key}
                    className="flex min-h-10 items-center gap-2 rounded-md border px-2.5 transition-colors"
                    style={
                      checked
                        ? {
                            borderColor: category.colorToken,
                            backgroundColor: `color-mix(in oklab, ${category.colorToken} 18%, transparent)`,
                          }
                        : { borderColor: "var(--border)" }
                    }
                  >
                    <Checkbox
                      id={`demografia-cat-${category.key}`}
                      checked={checked}
                      onCheckedChange={(value) => toggleCategory(category.key, value === true)}
                    />
                    <Label
                      htmlFor={`demografia-cat-${category.key}`}
                      className="flex flex-1 items-center gap-1.5 text-sm font-medium"
                      style={{ color: checked ? "var(--foreground)" : "var(--muted-foreground)" }}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category.colorToken }}
                        aria-hidden="true"
                      />
                      {category.label}
                    </Label>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">{group.hint}</p>
          </fieldset>
        ))}
      </div>
    </div>
  )
}
