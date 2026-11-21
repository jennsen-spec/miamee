import { supabase } from './supabase'
import { normalize, num } from './nutrition'
import type { DraftItem, Entry, Food, MealType, Portion } from './types'

function db() {
  if (!supabase) throw new Error("Supabase n'est pas configuré.")
  return supabase
}

const FOOD_COLS =
  'id, name, categorie, kcal, protein_g, carb_g, sugar_g, fat_g, satfat_g, fiber_g, sodium_mg'

const ITEM_COLS =
  'id, label, quantity_g, quantity_display, quantity_source, ' +
  'kcal, protein_g, carb_g, sugar_g, fat_g, satfat_g, fiber_g, sodium_mg'

/**
 * Recherche dans le referentiel. Chaque mot doit apparaitre, ce qui
 * laisse taper « pomme terre » pour trouver « Pomme de terre ».
 */
export async function searchFoods(query: string): Promise<Food[]> {
  const words = normalize(query).split(/\s+/).filter((w) => w.length >= 2)
  if (words.length === 0) return []

  let q = db().from('foods').select(FOOD_COLS)
  for (const w of words) q = q.like('name_norm', `%${w}%`)

  const { data, error } = await q.limit(40)
  if (error) throw error

  const first = words[0] ?? ''
  // Les noms courts sont les plus generiques : « Pomme de terre, crue »
  // doit passer avant « Pomme de terre, dauphine, surgelee, cuite ».
  return (data ?? [])
    .map((f) => ({ ...f, kcal: num(f.kcal) }) as Food)
    .sort((a, b) => {
      const aStarts = normalize(a.name).startsWith(first) ? 0 : 1
      const bStarts = normalize(b.name).startsWith(first) ? 0 : 1
      return aStarts - bStarts || a.name.length - b.name.length
    })
    .slice(0, 25)
}

/** Mesures menageres propres a l'aliment, puis les generiques. */
export async function portionsFor(foodId: number): Promise<Portion[]> {
  const { data, error } = await db()
    .from('portions')
    .select('id, food_id, label, grams')
    .or(`food_id.eq.${foodId},food_id.is.null`)
  if (error) throw error
  return (data ?? [])
    .map((p) => ({ ...p, grams: num(p.grams) }) as Portion)
    .sort((a, b) => (a.food_id === null ? 1 : 0) - (b.food_id === null ? 1 : 0))
}

export async function listEntries(fromIso: string, toIso: string): Promise<Entry[]> {
  const { data, error } = await db()
    .from('entries')
    .select(`id, eaten_at, meal_type, title, note, input_method, entry_items (${ITEM_COLS})`)
    .gte('eaten_at', fromIso)
    .lt('eaten_at', toIso)
    .order('eaten_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Entry[]
}

export async function saveEntry(input: {
  eatenAt: Date
  mealType: MealType
  title: string | null
  note: string | null
  items: DraftItem[]
}): Promise<number> {
  const { data: entry, error } = await db()
    .from('entries')
    .insert({
      eaten_at: input.eatenAt.toISOString(),
      meal_type: input.mealType,
      title: input.title,
      note: input.note,
      input_method: 'manuel',
    })
    .select('id')
    .single()
  if (error) throw error

  const rows = input.items.map((it, i) => ({
    entry_id: entry.id,
    position: i,
    label: it.label,
    food_id: it.food_id,
    quantity_g: it.quantity_g,
    quantity_display: it.quantity_display,
    quantity_source: it.quantity_source,
    kcal: it.kcal,
    protein_g: it.protein_g,
    carb_g: it.carb_g,
    sugar_g: it.sugar_g,
    fat_g: it.fat_g,
    satfat_g: it.satfat_g,
    fiber_g: it.fiber_g,
    sodium_mg: it.sodium_mg,
  }))

  const { error: itemsError } = await db().from('entry_items').insert(rows)
  if (itemsError) {
    // Une entree sans ligne ne vaut rien : on ne laisse pas de moitie.
    await db().from('entries').delete().eq('id', entry.id)
    throw itemsError
  }
  return entry.id as number
}

export async function deleteEntry(id: number): Promise<void> {
  const { error } = await db().from('entries').delete().eq('id', id)
  if (error) throw error
}
