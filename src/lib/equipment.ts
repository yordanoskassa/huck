// Shared equipment helpers — previously copy-pasted across page.tsx and
// loadboard/page.tsx. Additive only; does not modify types.ts or constants.ts.

/** Short codes used in dense table/badge displays. */
export const EQUIP_CODE: Record<string, string> = {
  'Dry Van': 'V',
  Reefer: 'R',
  Flatbed: 'F',
  'Step Deck': 'SD',
  'Power Only': 'PO',
}

export function equipCode(equipment: string): string {
  return EQUIP_CODE[equipment] ?? equipment.slice(0, 2).toUpperCase()
}

/** Tailwind classes for an equipment-type chip. */
export const EQUIP_COLORS: Record<string, string> = {
  'Dry Van': 'bg-info/15 text-info',
  Reefer: 'bg-chart-5/15 text-chart-5',
  Flatbed: 'bg-warning/15 text-warning',
  'Step Deck': 'bg-warning/15 text-warning',
  'Power Only': 'bg-muted text-muted-foreground',
}

export function equipColor(equipment: string): string {
  return EQUIP_COLORS[equipment] ?? 'bg-muted text-muted-foreground'
}
