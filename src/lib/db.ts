import { supabase } from './supabase'
import { num } from './nutrition'
import type { DraftItem, Entry, Food, MealType, Portion } from './types'

function db() {
  if (!supabase) throw new Error("Supabase n'est pas configuré.")
  return supabase
}

const ITEM_COLS =
  'id, label, quantity_g, quantity_display, quantity_source, ' +
  'kcal, protein_g, carb_g, sugar_g, fat_g, satfat_g, fiber_g, sodium_mg'

/**
 * Recherche dans le referentiel. Deleguee a la fonction SQL, qui gere
 * les synonymes (« coquillettes » -> pates) et refuse les faux amis.
 */
export async function searchFoods(query: string): Promise<Food[]> {
  if (query.trim().length < 2) return []
  const { data, error } = await db().rpc('rechercher_aliments', { terme: query, limite: 25 })
  if (error) throw error
  return ((data ?? []) as Food[]).map((f) => ({ ...f, kcal: num(f.kcal) }))
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
  inputMethod?: 'manuel' | 'texte' | 'photo_plat' | 'photo_etiquette' | 'code_barres'
  photoPath?: string | null
}): Promise<number> {
  const { data: entry, error } = await db()
    .from('entries')
    .insert({
      eaten_at: input.eatenAt.toISOString(),
      meal_type: input.mealType,
      title: input.title,
      note: input.note,
      input_method: input.inputMethod ?? 'manuel',
      photo_path: input.photoPath ?? null,
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
    confidence: it.confidence ?? null,
    ai_raw: it.ai_raw ?? null,
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

/** Envoie la photo dans l'espace prive du compte et rend son chemin. */
export async function envoyerPhoto(blob: Blob): Promise<string> {
  const { data: u } = await db().auth.getUser()
  const uid = u.user?.id
  if (!uid) throw new Error('Compte introuvable.')

  const chemin = `${uid}/${crypto.randomUUID()}.jpg`
  const { error } = await db().storage.from('repas').upload(chemin, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return chemin
}
