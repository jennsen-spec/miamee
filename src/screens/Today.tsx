import { useCallback, useEffect, useState } from 'react'
import { deleteEntry, listEntries } from '../lib/db'
import { MEAL_LABELS, emptyMacros, num, sumMacros } from '../lib/nutrition'
import type { Entry } from '../lib/types'

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })

function titreDuJour(d: Date): string {
  const now = new Date()
  if (sameDay(d, now)) return "Aujourd'hui"
  if (sameDay(d, addDays(now, -1))) return 'Hier'
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Today({ onPhoto, onManuel }:
  { onPhoto: () => void; onManuel: () => void }) {
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const from = day.toISOString()
      const to = addDays(day, 1).toISOString()
      setEntries(await listEntries(from, to))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture impossible.')
    } finally {
      setLoading(false)
    }
  }, [day])

  useEffect(() => { void load() }, [load])

  const allItems = entries.flatMap((e) => e.entry_items ?? [])
  const total = allItems.length ? sumMacros(allItems) : emptyMacros()
  const kcalEstimees = allItems
    .filter((i) => i.quantity_source === 'estime')
    .reduce((s, i) => s + num(i.kcal), 0)
  const partEstimee = total.kcal > 0 ? Math.round((100 * kcalEstimees) / total.kcal) : 0

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true

  async function remove(id: number) {
    if (!window.confirm('Supprimer cette entrée ?')) return
    try {
      await deleteEntry(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible.')
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-32"
         style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
      <h1 className="text-sm font-medium">Miamee</h1>

      {/* Navigation entre les jours */}
      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={() => setDay((d) => addDays(d, -1))}
          className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-cream-dim"
        >
          ←
        </button>
        <p className="text-lg font-medium first-letter:uppercase">{titreDuJour(day)}</p>
        <button
          onClick={() => setDay((d) => addDays(d, 1))}
          disabled={sameDay(day, new Date())}
          className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-cream-dim disabled:opacity-25"
        >
          →
        </button>
      </div>

      {/* Totaux du jour */}
      <section className="mt-5 rounded-2xl border border-ink-line bg-ink-soft/60 p-5">
        <p className="text-5xl font-semibold tabular-nums">
          {total.kcal}
          <span className="ml-2 text-base font-normal text-cream-dim">kcal</span>
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {([
            ['Protéines', total.protein_g, 'g'],
            ['Glucides', total.carb_g, 'g'],
            ['Lipides', total.fat_g, 'g'],
            ['Fibres', total.fiber_g ?? 0, 'g'],
          ] as const).map(([k, v, u]) => (
            <div key={k}>
              <p className="text-base tabular-nums">{v}<span className="text-xs text-cream-dim">{u}</span></p>
              <p className="mt-0.5 text-[10px] tracking-wide text-cream-dim uppercase">{k}</p>
            </div>
          ))}
        </div>
        {partEstimee > 0 && (
          <p className="mt-4 text-xs text-warn">
            {partEstimee} % de ces calories reposent sur une estimation.
          </p>
        )}
      </section>

      {!isStandalone && (
        <p className="mt-4 rounded-xl border border-ink-line/60 px-4 py-3 text-xs leading-relaxed text-cream-dim">
          Installe Miamee : <span className="text-cream">Partager → Sur l'écran d'accueil</span>.
          L'app s'ouvrira en plein écran et fonctionnera hors ligne.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-bad">{error}</p>}

      {/* Journal */}
      <h2 className="mt-8 text-xs tracking-wide text-cream-dim uppercase">Journal</h2>
      {loading ? (
        <p className="mt-3 text-sm text-cream-dim">Chargement…</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-cream-dim">
          Rien de noté pour ce jour.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {entries.map((e) => {
            const items = e.entry_items ?? []
            const t = items.length ? sumMacros(items) : emptyMacros()
            return (
              <li key={e.id} className="rounded-2xl border border-ink-line bg-ink-soft/60 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {heure(e.eaten_at)}
                      <span className="ml-2 font-normal text-cream-dim">
                        {MEAL_LABELS[e.meal_type]}
                      </span>
                    </p>
                    {e.title && <p className="mt-0.5 truncate text-xs text-cream-dim">{e.title}</p>}
                  </div>
                  <p className="shrink-0 text-sm tabular-nums">{t.kcal} kcal</p>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="min-w-0 flex-1 text-cream-dim">
                        {i.label}
                        {i.quantity_source === 'estime' && (
                          <span className="ml-1.5 text-warn">·estimé</span>
                        )}
                      </span>
                      <span className="shrink-0 text-cream-dim tabular-nums">
                        {i.quantity_display ?? (i.quantity_g !== null ? `${num(i.quantity_g)} g` : '—')}
                      </span>
                      <span className="w-16 shrink-0 text-right tabular-nums">
                        {Math.round(num(i.kcal))} kcal
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => void remove(e.id)}
                  className="mt-3 text-xs text-cream-dim underline underline-offset-2"
                >
                  supprimer
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/95 to-transparent pt-6"
           style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-md px-5">
          <button
            onClick={onPhoto}
            className="w-full rounded-xl bg-food px-4 py-3.5 text-base font-medium text-ink"
          >
            Photographier un repas
          </button>
          <button onClick={onManuel} className="mt-1 w-full py-2 text-xs text-cream-dim">
            ou saisir à la main
          </button>
        </div>
      </div>
    </div>
  )
}
