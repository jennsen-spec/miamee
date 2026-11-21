import { useEffect, useMemo, useState } from 'react'
import { portionsFor, saveEntry, searchFoods } from '../lib/db'
import {
  MEAL_LABELS, MEAL_ORDER, emptyMacros, guessMealType, num, partEstimee, scaleTo, sumMacros,
} from '../lib/nutrition'
import type { DraftItem, Food, MealType, Portion } from '../lib/types'

/** Date -> valeur d'un <input type="datetime-local"> en heure locale. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function AddEntry({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [when, setWhen] = useState(() => toLocalInput(new Date()))
  const [mealType, setMealType] = useState<MealType>(() => guessMealType(new Date()))
  const [mealTouched, setMealTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [picker, setPicker] = useState<'ferme' | 'recherche' | 'manuel'>('ferme')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eatenAt = useMemo(() => new Date(when), [when])

  // Tant que l'utilisateur n'a pas choisi lui-meme, le moment suit l'heure.
  useEffect(() => {
    if (!mealTouched && !Number.isNaN(eatenAt.getTime())) setMealType(guessMealType(eatenAt))
  }, [eatenAt, mealTouched])

  const total = useMemo(() => (items.length ? sumMacros(items) : emptyMacros()), [items])
  const estime = partEstimee(items)

  async function save() {
    if (items.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await saveEntry({
        eatenAt,
        mealType,
        title: title.trim() || null,
        note: null,
        items,
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.")
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-40"
         style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="-ml-1 px-1 py-2 text-sm text-cream-dim">
          ← Annuler
        </button>
        <h1 className="text-sm font-medium">Nouvelle entrée</h1>
        <span className="w-16" />
      </div>

      {/* Quand */}
      <label className="mt-6 block text-xs tracking-wide text-cream-dim uppercase">
        Quand
      </label>
      <input
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="mt-2 w-full rounded-xl border border-ink-line bg-ink-soft px-4 py-3
                   text-base outline-none focus:border-food"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {MEAL_ORDER.map((m) => (
          <button
            key={m}
            onClick={() => { setMealType(m); setMealTouched(true) }}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              mealType === m
                ? 'bg-food text-ink'
                : 'border border-ink-line text-cream-dim'
            }`}
          >
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>
      {!mealTouched && (
        <p className="mt-2 text-xs text-cream-dim">Deviné d'après l'heure. Change-le si besoin.</p>
      )}

      {/* Titre libre */}
      <label className="mt-6 block text-xs tracking-wide text-cream-dim uppercase">
        Intitulé <span className="normal-case">(facultatif)</span>
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Purée maison, côte de porc…"
        className="mt-2 w-full rounded-xl border border-ink-line bg-ink-soft px-4 py-3
                   text-base outline-none placeholder:text-cream-dim/50 focus:border-food"
      />

      {/* Lignes */}
      <h2 className="mt-8 text-xs tracking-wide text-cream-dim uppercase">Aliments</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-cream-dim">Aucun aliment pour l'instant.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-line/60 rounded-2xl border border-ink-line bg-ink-soft/60">
          {items.map((it) => (
            <li key={it.key} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{it.label}</p>
                <p className="mt-0.5 text-xs text-cream-dim">
                  {it.quantity_display ?? (it.quantity_g !== null ? `${it.quantity_g} g` : 'valeurs saisies')}
                  {it.quantity_source === 'estime' && (
                    <span className="ml-2 rounded bg-warn/15 px-1.5 py-0.5 text-warn">estimé</span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm tabular-nums">{Math.round(num(it.kcal))} kcal</p>
                <button
                  onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}
                  className="mt-0.5 text-xs text-cream-dim underline underline-offset-2"
                >
                  retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setPicker('recherche')}
          className="flex-1 rounded-xl border border-ink-line bg-ink-soft px-4 py-3 text-sm"
        >
          + Chercher un aliment
        </button>
        <button
          onClick={() => setPicker('manuel')}
          className="rounded-xl border border-ink-line bg-ink-soft px-4 py-3 text-sm text-cream-dim"
        >
          Valeurs à la main
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-bad">{error}</p>}

      {/* Total colle en bas */}
      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-ink-line bg-ink/95 backdrop-blur"
             style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto max-w-md px-5 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">{total.kcal} kcal</span>
              <span className="text-xs text-cream-dim tabular-nums">
                P {total.protein_g} · G {total.carb_g} · L {total.fat_g}
                {estime > 0 && <span className="ml-2 text-warn">{estime} % estimé</span>}
              </span>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="mt-3 w-full rounded-xl bg-food px-4 py-3.5 text-base font-medium text-ink disabled:opacity-40"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {picker === 'recherche' && (
        <FoodPicker
          onClose={() => setPicker('ferme')}
          onPick={(it) => { setItems((xs) => [...xs, it]); setPicker('ferme') }}
        />
      )}
      {picker === 'manuel' && (
        <ManualPicker
          onClose={() => setPicker('ferme')}
          onPick={(it) => { setItems((xs) => [...xs, it]); setPicker('ferme') }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function Sheet({ title, onClose, children }:
  { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink">
      <div className="mx-auto max-w-md px-5 pb-16"
           style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="-ml-1 px-1 py-2 text-sm text-cream-dim">← Retour</button>
          <h2 className="text-sm font-medium">{title}</h2>
          <span className="w-16" />
        </div>
        {children}
      </div>
    </div>
  )
}

function FoodPicker({ onPick, onClose }:
  { onPick: (i: DraftItem) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [busy, setBusy] = useState(false)
  const [chosen, setChosen] = useState<Food | null>(null)

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    let alive = true
    setBusy(true)
    const t = setTimeout(() => {
      searchFoods(q)
        .then((r) => { if (alive) setResults(r) })
        .catch(() => { if (alive) setResults([]) })
        .finally(() => { if (alive) setBusy(false) })
    }, 220)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  if (chosen) {
    return (
      <Sheet title="Quantité" onClose={() => setChosen(null)}>
        <QuantityEditor food={chosen} onConfirm={onPick} />
      </Sheet>
    )
  }

  return (
    <Sheet title="Chercher un aliment" onClose={onClose}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="pomme de terre, beurre, riz…"
        className="mt-5 w-full rounded-xl border border-ink-line bg-ink-soft px-4 py-3
                   text-base outline-none placeholder:text-cream-dim/50 focus:border-food"
      />
      {busy && <p className="mt-4 text-sm text-cream-dim">Recherche…</p>}
      {!busy && q.trim().length >= 2 && results.length === 0 && (
        <p className="mt-4 text-sm text-cream-dim">
          Rien trouvé. Tu peux saisir les valeurs à la main depuis l'écran précédent.
        </p>
      )}
      <ul className="mt-4 divide-y divide-ink-line/60">
        {results.map((f) => (
          <li key={f.id}>
            <button onClick={() => setChosen(f)} className="w-full py-3 text-left">
              <p className="text-sm leading-snug">{f.name}</p>
              <p className="mt-0.5 text-xs text-cream-dim tabular-nums">
                {Math.round(num(f.kcal))} kcal / 100 g
                {f.categorie && <span className="ml-2">· {f.categorie}</span>}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

function QuantityEditor({ food, onConfirm }:
  { food: Food; onConfirm: (i: DraftItem) => void }) {
  const [portions, setPortions] = useState<Portion[]>([])
  const [unit, setUnit] = useState<'g' | number>('g')
  const [amount, setAmount] = useState('100')

  useEffect(() => {
    portionsFor(food.id).then(setPortions).catch(() => setPortions([]))
  }, [food.id])

  const portion = typeof unit === 'number' ? portions.find((p) => p.id === unit) : undefined
  const n = Number(amount.replace(',', '.'))
  const grams = !Number.isFinite(n) || n <= 0 ? 0 : portion ? n * portion.grams : n
  const macros = scaleTo(food, grams)

  function pickUnit(u: 'g' | number) {
    setUnit(u)
    setAmount(u === 'g' ? '100' : '1')
  }

  return (
    <div>
      <p className="mt-5 text-sm leading-snug">{food.name}</p>
      <p className="mt-0.5 text-xs text-cream-dim tabular-nums">
        {Math.round(num(food.kcal))} kcal / 100 g
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => pickUnit('g')}
          className={`rounded-full px-3.5 py-1.5 text-sm ${
            unit === 'g' ? 'bg-food text-ink' : 'border border-ink-line text-cream-dim'
          }`}
        >
          grammes
        </button>
        {portions.map((p) => (
          <button
            key={p.id}
            onClick={() => pickUnit(p.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              unit === p.id ? 'bg-food text-ink' : 'border border-ink-line text-cream-dim'
            }`}
          >
            {p.label}
            {p.food_id === null && <span className="ml-1 opacity-60">·</span>}
          </button>
        ))}
      </div>

      <input
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mt-4 w-full rounded-xl border border-ink-line bg-ink-soft px-4 py-3
                   text-base outline-none focus:border-food"
      />

      <p className="mt-3 text-sm text-cream-dim tabular-nums">
        {grams > 0 ? `${Math.round(grams * 10) / 10} g · ${macros.kcal} kcal` : '—'}
      </p>
      <p className="mt-1 text-xs text-cream-dim">
        {unit === 'g'
          ? 'Un poids que tu donnes est enregistré comme pesé.'
          : 'Une mesure ménagère est un ordre de grandeur : la ligne sera marquée estimée.'}
      </p>

      <button
        disabled={grams <= 0}
        onClick={() =>
          onConfirm({
            key: crypto.randomUUID(),
            label: food.name,
            food_id: food.id,
            quantity_g: Math.round(grams * 100) / 100,
            quantity_display: portion ? `${amount} × ${portion.label}` : null,
            quantity_source: portion ? 'estime' : 'pese',
            ...macros,
          })
        }
        className="mt-6 w-full rounded-xl bg-food px-4 py-3.5 text-base font-medium text-ink disabled:opacity-40"
      >
        Ajouter
      </button>
    </div>
  )
}

function ManualPicker({ onPick, onClose }:
  { onPick: (i: DraftItem) => void; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [f, setF] = useState({ kcal: '', protein_g: '', carb_g: '', fat_g: '', fiber_g: '' })
  const v = (s: string) => {
    const n = Number(s.replace(',', '.'))
    return Number.isFinite(n) && s.trim() !== '' ? n : 0
  }
  const ok = label.trim().length > 0 && (v(f.kcal) > 0 || v(f.protein_g) > 0 || v(f.carb_g) > 0 || v(f.fat_g) > 0)

  const champs: [keyof typeof f, string, string][] = [
    ['kcal', 'Calories', 'kcal'],
    ['protein_g', 'Protéines', 'g'],
    ['carb_g', 'Glucides', 'g'],
    ['fat_g', 'Lipides', 'g'],
    ['fiber_g', 'Fibres', 'g'],
  ]

  return (
    <Sheet title="Valeurs à la main" onClose={onClose}>
      <p className="mt-5 text-xs leading-relaxed text-cream-dim">
        Pour ce que tu connais déjà : un nombre de protéines, les valeurs lues sur un emballage.
        Rien n'est estimé, tout est enregistré tel que tu l'écris.
      </p>

      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Ce que c'était"
        className="mt-5 w-full rounded-xl border border-ink-line bg-ink-soft px-4 py-3
                   text-base outline-none placeholder:text-cream-dim/50 focus:border-food"
      />

      <div className="mt-4 space-y-3">
        {champs.map(([k, labelFr, unite]) => (
          <div key={k} className="flex items-center gap-3">
            <label className="w-28 shrink-0 text-sm text-cream-dim">{labelFr}</label>
            <input
              type="text"
              inputMode="decimal"
              value={f[k]}
              onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))}
              className="min-w-0 flex-1 rounded-xl border border-ink-line bg-ink-soft px-4 py-2.5
                         text-base outline-none focus:border-food"
            />
            <span className="w-8 shrink-0 text-sm text-cream-dim">{unite}</span>
          </div>
        ))}
      </div>

      <button
        disabled={!ok}
        onClick={() =>
          onPick({
            key: crypto.randomUUID(),
            label: label.trim(),
            food_id: null,
            quantity_g: null,
            quantity_display: null,
            quantity_source: 'pese',
            kcal: v(f.kcal),
            protein_g: v(f.protein_g),
            carb_g: v(f.carb_g),
            sugar_g: null,
            fat_g: v(f.fat_g),
            satfat_g: null,
            fiber_g: f.fiber_g.trim() === '' ? null : v(f.fiber_g),
            sodium_mg: null,
          })
        }
        className="mt-6 w-full rounded-xl bg-food px-4 py-3.5 text-base font-medium text-ink disabled:opacity-40"
      >
        Ajouter
      </button>
    </Sheet>
  )
}
