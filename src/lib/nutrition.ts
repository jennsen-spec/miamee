import type { DraftItem, Macros, MealType } from './types'

/** PostgREST peut rendre les colonnes numeric sous forme de chaine. */
export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : num(v)

const r1 = (n: number) => Math.round(n * 10) / 10

/** Met a l'echelle des valeurs pour 100 g sur un poids reel. */
export function scaleTo(per100g: Macros, grams: number): Macros {
  const f = grams / 100
  const opt = (v: number | null) => (v === null ? null : r1(num(v) * f))
  return {
    kcal: Math.round(num(per100g.kcal) * f),
    protein_g: r1(num(per100g.protein_g) * f),
    carb_g: r1(num(per100g.carb_g) * f),
    sugar_g: opt(numOrNull(per100g.sugar_g)),
    fat_g: r1(num(per100g.fat_g) * f),
    satfat_g: opt(numOrNull(per100g.satfat_g)),
    fiber_g: opt(numOrNull(per100g.fiber_g)),
    sodium_mg: opt(numOrNull(per100g.sodium_mg)),
  }
}

export const emptyMacros = (): Macros => ({
  kcal: 0, protein_g: 0, carb_g: 0, sugar_g: null,
  fat_g: 0, satfat_g: null, fiber_g: null, sodium_mg: null,
})

export function sumMacros(items: Macros[]): Macros {
  const acc = emptyMacros()
  let sugar = 0, satfat = 0, fiber = 0, sodium = 0
  let hasSugar = false, hasSatfat = false, hasFiber = false, hasSodium = false
  for (const i of items) {
    acc.kcal += num(i.kcal)
    acc.protein_g += num(i.protein_g)
    acc.carb_g += num(i.carb_g)
    acc.fat_g += num(i.fat_g)
    if (i.sugar_g !== null)  { sugar += num(i.sugar_g); hasSugar = true }
    if (i.satfat_g !== null) { satfat += num(i.satfat_g); hasSatfat = true }
    if (i.fiber_g !== null)  { fiber += num(i.fiber_g); hasFiber = true }
    if (i.sodium_mg !== null){ sodium += num(i.sodium_mg); hasSodium = true }
  }
  acc.kcal = Math.round(acc.kcal)
  acc.protein_g = r1(acc.protein_g)
  acc.carb_g = r1(acc.carb_g)
  acc.fat_g = r1(acc.fat_g)
  acc.sugar_g = hasSugar ? r1(sugar) : null
  acc.satfat_g = hasSatfat ? r1(satfat) : null
  acc.fiber_g = hasFiber ? r1(fiber) : null
  acc.sodium_mg = hasSodium ? Math.round(sodium) : null
  return acc
}

/**
 * Devine le moment du repas d'apres l'heure. Toujours modifiable :
 * un muffin a 10 h au travail est une collation, pas un repas.
 */
export function guessMealType(d: Date): MealType {
  const m = d.getHours() * 60 + d.getMinutes()
  if (m >= 6 * 60 && m < 10 * 60 + 30) return 'petit_dejeuner'
  if (m >= 11 * 60 && m < 14 * 60 + 30) return 'dejeuner'
  if (m >= 17 * 60 + 30 && m < 21 * 60 + 30) return 'diner'
  return 'collation'
}

export const MEAL_LABELS: Record<MealType, string> = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  collation: 'Collation',
}

export const MEAL_ORDER: MealType[] = ['petit_dejeuner', 'dejeuner', 'diner', 'collation']

/** Enleve accents et casse, comme le fait norm_text cote base. */
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export const partEstimee = (items: DraftItem[]): number => {
  const total = items.reduce((s, i) => s + num(i.kcal), 0)
  if (total <= 0) return 0
  const est = items
    .filter((i) => i.quantity_source === 'estime')
    .reduce((s, i) => s + num(i.kcal), 0)
  return Math.round((100 * est) / total)
}
