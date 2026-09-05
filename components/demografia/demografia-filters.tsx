"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  AVAILABLE_YEARS,
  DEMOGRAFIA_CATEGORIES,
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
          className="justify-start"
        >
          {AVAILABLE_YEARS.map((y) => (
            <ToggleGroupItem key={y} value={String(y)} aria-label={`Año ${y}`}>
              {y}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <fieldset className="mt-5 flex flex-col gap-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Categoría de población
        </legend>
        <div className="grid grid-cols-2 gap-1">
          {DEMOGRAFIA_CATEGORIES.map((category) => {
            const checked = selectedCategories.includes(category.key)
            return (
              <div key={category.key} className="flex min-h-10 items-center gap-2">
                <Checkbox
                  id={`demografia-cat-${category.key}`}
                  checked={checked}
                  onCheckedChange={(value) => toggleCategory(category.key, value === true)}
                />
                <Label
                  htmlFor={`demografia-cat-${category.key}`}
                  className="flex min-h-10 flex-1 items-center gap-1.5 text-sm font-normal"
                >
                  <span
                    className={`size-2.5 rounded-full ${category.swatchClass}`}
                    aria-hidden="true"
                  />
                  {category.label}
                </Label>
              </div>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
