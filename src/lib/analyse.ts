import { supabase } from './supabase'
import { normalize, num, scaleTo } from './nutrition'
import type { Food, Macros } from './types'

export type IngredientDetecte = {
  libelle: string
  aliment_generique: string
  forme: string | null
  grammes: number
  origine_quantite: 'pese' | 'estime'
  confiance: number
}

export type Analyse = {
  titre: string
  ingredients: IngredientDetecte[]
  incertitudes: string[]
}

export type Produit = Macros & {
  id: number
  brand: string | null
  name: string
  kind: string | null
  kind_norm: string | null
  food_id: number | null
}

/** Une ligne prete a etre revue par l'utilisateur. */
export type LigneRevue = {
  key: string
  detecte: IngredientDetecte
  aliment: Food | null
  alternatives: Food[]
  produits: Produit[]      // produits compatibles, selon la regle d'appariement
  produitChoisi: number | null
  grammes: number
  origine: 'pese' | 'estime'
  besoinArbitrage: boolean // plusieurs produits possibles : il faut demander
}

const PRODUIT_COLS =
  'id, brand, name, kind, kind_norm, food_id, kcal, protein_g, carb_g, sugar_g, ' +
  'fat_g, satfat_g, fiber_g, sodium_mg'

export async function analyserRepas(entree: {
  image?: string
  mimeType?: string
  texte?: string
}): Promise<Analyse> {
  if (!supabase) throw new Error("Supabase n'est pas configuré.")

  const { data, error } = await supabase.functions.invoke('analyser-repas', { body: entree })

  if (error) {
    // invoke masque le corps de la reponse : on va le rechercher pour
    // pouvoir expliquer precisement ce qui bloque.
    let code = 'inconnu'
    let message = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const corps = await ctx.json()
        code = corps?.code ?? code
        message = corps?.message ?? message
      } catch { /* on garde le message d'origine */ }
    }
    throw Object.assign(new Error(message), { code })
  }

  const a = data?.analyse
  return {
    titre: typeof a?.titre === 'string' ? a.titre : '',
    ingredients: Array.isArray(a?.ingredients) ? a.ingredients : [],
    incertitudes: Array.isArray(a?.incertitudes) ? a.incertitudes : [],
  }
}

/**
 * Appariement. Le modele a decrit sans connaitre la bibliotheque de
 * produits ; c'est ici, et seulement ici, qu'on regarde si l'un d'eux
 * correspond. Un produit n'est retenu que si sa forme precise colle a
 * ce qui a ete observe : un paquet de spaghetti n'est jamais candidat
 * pour une assiette de coquillettes.
 */
export async function apparier(ing: IngredientDetecte): Promise<LigneRevue> {
  if (!supabase) throw new Error("Supabase n'est pas configuré.")

  const { data: alims } = await supabase.rpc('rechercher_aliments', {
    terme: ing.aliment_generique,
    limite: 6,
  })
  const trouves = ((alims ?? []) as Food[]).map((f) => ({ ...f, kcal: num(f.kcal) }))
  const aliment = trouves[0] ?? null

  let produits: Produit[] = []
  if (aliment) {
    const { data: prods } = await supabase
      .from('products')
      .select(PRODUIT_COLS)
      .eq('food_id', aliment.id)

    const formeVue = ing.forme ? normalize(ing.forme) : null
    produits = ((prods ?? []) as unknown as Produit[]).filter((p) => {
      if (!formeVue || !p.kind_norm) return true      // rien ne permet d'exclure
      return p.kind_norm === formeVue                  // formes identiques seulement
    })
  }

  return {
    key: crypto.randomUUID(),
    detecte: ing,
    aliment,
    alternatives: trouves.slice(1),
    produits,
    // Un seul candidat : on le propose d'emblee. Plusieurs : on demande.
    produitChoisi: produits.length === 1 ? (produits[0]?.id ?? null) : null,
    grammes: Math.max(0, Math.round(num(ing.grammes) * 10) / 10),
    origine: ing.origine_quantite === 'pese' ? 'pese' : 'estime',
    besoinArbitrage: produits.length > 1,
  }
}

/** Source des valeurs : le produit choisi s'il y en a un, sinon le générique. */
export function macrosDeLaLigne(l: LigneRevue): Macros | null {
  const produit = l.produits.find((p) => p.id === l.produitChoisi)
  const base: Macros | null = produit ?? l.aliment
  if (!base || l.grammes <= 0) return null
  return scaleTo(base, l.grammes)
}

export function libelleSource(l: LigneRevue): string {
  const produit = l.produits.find((p) => p.id === l.produitChoisi)
  if (produit) return [produit.brand, produit.name].filter(Boolean).join(' ')
  return l.aliment?.name ?? '—'
}
