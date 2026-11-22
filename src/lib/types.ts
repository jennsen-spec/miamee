export type MealType = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation'
export type QuantitySource = 'pese' | 'estime'

/** Valeurs nutritionnelles, toujours pour 100 g dans les referentiels. */
export type Macros = {
  kcal: number
  protein_g: number
  carb_g: number
  sugar_g: number | null
  fat_g: number
  satfat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
}

export type Food = Macros & {
  id: number
  name: string
  categorie: string | null
}

export type Portion = {
  id: number
  food_id: number | null
  label: string
  grams: number
}

/** Une ligne en cours de saisie, pas encore enregistree. */
export type DraftItem = Macros & {
  key: string
  label: string
  food_id: number | null
  quantity_g: number | null
  quantity_display: string | null
  quantity_source: QuantitySource
  confidence?: number | null
  ai_raw?: unknown
}

export type Entry = {
  id: number
  eaten_at: string
  meal_type: MealType
  title: string | null
  note: string | null
  input_method: string
  entry_items: SavedItem[]
}

export type SavedItem = Macros & {
  id: number
  label: string
  quantity_g: number | null
  quantity_display: string | null
  quantity_source: QuantitySource
}
