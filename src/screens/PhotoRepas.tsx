import { useEffect, useMemo, useRef, useState } from 'react'
import { apparier, analyserRepas, libelleSource, macrosDeLaLigne } from '../lib/analyse'
import type { Analyse, LigneRevue } from '../lib/analyse'
import { envoyerPhoto, saveEntry, searchFoods } from '../lib/db'
import { preparerPhoto } from '../lib/image'
import type { PhotoPrete } from '../lib/image'
import {
  MEAL_LABELS, MEAL_ORDER, emptyMacros, guessMealType, num, sumMacros,
} from '../lib/nutrition'
import type { DraftItem, Food, MealType } from '../lib/types'

type Etape = 'capture' | 'analyse' | 'revue'

const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function PhotoRepas({
  onDone, onCancel, onManuel,
}: { onDone: () => void; onCancel: () => void; onManuel: () => void }) {
  const [etape, setEtape] = useState<Etape>('capture')
  const [photo, setPhoto] = useState<PhotoPrete | null>(null)
  const [texte, setTexte] = useState('')
  const [analyse, setAnalyse] = useState<Analyse | null>(null)
  const [lignes, setLignes] = useState<LigneRevue[]>([])
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null)

  // On libere l'URL de l'apercu quand la photo change ou que l'ecran part.
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.apercu) }, [photo])

  async function choisirFichier(f: File | undefined) {
    if (!f) return
    setErreur(null)
    try {
      const p = await preparerPhoto(f)
      setPhoto((ancienne) => {
        if (ancienne) URL.revokeObjectURL(ancienne.apercu)
        return p
      })
    } catch (e) {
      setErreur({ code: 'photo', message: e instanceof Error ? e.message : 'Photo illisible.' })
    }
  }

  async function lancerAnalyse() {
    setEtape('analyse')
    setErreur(null)
    try {
      const a = await analyserRepas({
        image: photo?.base64,
        mimeType: photo?.mimeType,
        texte: texte.trim() || undefined,
      })
      setAnalyse(a)
      setLignes(await Promise.all(a.ingredients.map(apparier)))
      setEtape('revue')
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'inconnu'
      setErreur({ code, message: e instanceof Error ? e.message : 'Analyse impossible.' })
      setEtape('capture')
    }
  }

  if (etape === 'analyse') {
    return (
      <Cadre titre="Analyse" onRetour={() => setEtape('capture')}>
        <div className="mt-20 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-ink-line border-t-food" />
          <p className="mt-6 text-sm text-cream-dim">Je regarde ce qu'il y a dans l'assiette…</p>
          <p className="mt-2 text-xs text-cream-dim">Quelques secondes.</p>
        </div>
      </Cadre>
    )
  }

  if (etape === 'revue' && analyse) {
    return (
      <Revue
        analyse={analyse}
        lignes={lignes}
        setLignes={setLignes}
        photo={photo}
        avaitTexte={texte.trim().length > 0}
        onRetour={() => setEtape('capture')}
        onDone={onDone}
      />
    )
  }

  return (
    <Cadre titre="Nouveau repas" onRetour={onCancel}>
      <Capture
        photo={photo}
        texte={texte}
        setTexte={setTexte}
        onFichier={choisirFichier}
        onRetirer={() => setPhoto((p) => { if (p) URL.revokeObjectURL(p.apercu); return null })}
        onAnalyser={lancerAnalyse}
        erreur={erreur}
        onManuel={onManuel}
      />
    </Cadre>
  )
}

/* ---------------------------------------------------------------- */

function Cadre({ titre, onRetour, children }:
  { titre: string; onRetour: () => void; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-5 pb-40"
         style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
      <div className="flex items-center justify-between">
        <button onClick={onRetour} className="-ml-1 px-1 py-2 text-sm text-cream-dim">← Retour</button>
        <h1 className="text-sm font-medium">{titre}</h1>
        <span className="w-16" />
      </div>
      {children}
    </div>
  )
}

function Capture({
  photo, texte, setTexte, onFichier, onRetirer, onAnalyser, erreur, onManuel,
}: {
  photo: PhotoPrete | null
  texte: string
  setTexte: (s: string) => void
  onFichier: (f: File | undefined) => void
  onRetirer: () => void
  onAnalyser: () => void
  erreur: { code: string; message: string } | null
  onManuel: () => void
}) {
  const appareil = useRef<HTMLInputElement>(null)
  const galerie = useRef<HTMLInputElement>(null)

  return (
    <>
      {photo ? (
        <div className="mt-5">
          <img src={photo.apercu} alt="" className="w-full rounded-2xl border border-ink-line" />
          <div className="mt-2 flex items-center justify-between text-xs text-cream-dim">
            <span>{photo.largeur}×{photo.hauteur} · {Math.round(photo.blob.size / 1024)} ko</span>
            <button onClick={onRetirer} className="underline underline-offset-2">retirer</button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => appareil.current?.click()}
            className="rounded-2xl bg-food px-4 py-8 text-base font-medium text-ink"
          >
            Photographier
          </button>
          <button
            onClick={() => galerie.current?.click()}
            className="rounded-2xl border border-ink-line bg-ink-soft px-4 py-8 text-base text-cream-dim"
          >
            Choisir une photo
          </button>
        </div>
      )}

      <input ref={appareil} type="file" accept="image/*" capture="environment" className="hidden"
             onChange={(e) => onFichier(e.target.files?.[0])} />
      <input ref={galerie} type="file" accept="image/*" className="hidden"
             onChange={(e) => onFichier(e.target.files?.[0])} />

      <label className="mt-7 block text-xs tracking-wide text-cream-dim uppercase">
        Ce que tu en sais <span className="normal-case">(facultatif)</span>
      </label>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={4}
        placeholder="Une purée avec cette pomme de terre qui pèse 180 g, deux cuillères à café de beurre, 5 gros champignons et un filet d'huile d'olive…"
        className="mt-2 w-full resize-none rounded-xl border border-ink-line bg-ink-soft px-4 py-3
                   text-base leading-relaxed outline-none placeholder:text-cream-dim/40 focus:border-food"
      />
      <p className="mt-2 text-xs leading-relaxed text-cream-dim">
        Les poids que tu donnes sont repris tels quels. Le reste est estimé d'après la photo.
      </p>

      {erreur && <Erreur erreur={erreur} onManuel={onManuel} />}

      <button
        onClick={onAnalyser}
        disabled={!photo && texte.trim().length < 3}
        className="mt-6 w-full rounded-xl bg-food px-4 py-3.5 text-base font-medium text-ink disabled:opacity-40"
      >
        Analyser
      </button>
      <button onClick={onManuel} className="mt-3 w-full py-2 text-sm text-cream-dim">
        Saisir à la main
      </button>
    </>
  )
}

function Erreur({ erreur, onManuel }:
  { erreur: { code: string; message: string }; onManuel: () => void }) {
  const textes: Record<string, { titre: string; quoiFaire: React.ReactNode }> = {
    cle_absente: {
      titre: 'Aucune clé Gemini installée',
      quoiFaire: <>La reconnaissance d'image ne peut pas fonctionner sans elle.</>,
    },
    facturation: {
      titre: 'Le projet Google de la clé est bloqué',
      quoiFaire: (
        <>
          Ses crédits prépayés sont épuisés, ce qui coupe aussi le palier gratuit. Crée une clé
          dans un <span className="text-cream">nouveau</span> projet sur{' '}
          <a href="https://aistudio.google.com/apikey" className="text-food underline underline-offset-4">
            aistudio.google.com/apikey
          </a>.
        </>
      ),
    },
    quota: {
      titre: 'Quota Gemini atteint',
      quoiFaire: <>Le quota gratuit se remet à zéro à minuit, heure du Pacifique.</>,
    },
  }
  const t = textes[erreur.code]

  return (
    <div className="mt-6 rounded-2xl border border-bad/40 bg-bad/5 p-4">
      <p className="text-sm font-medium text-bad">{t?.titre ?? "L'analyse a échoué"}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-cream-dim">
        {t?.quoiFaire ?? erreur.message}
      </p>
      <button onClick={onManuel} className="mt-3 text-xs text-cream underline underline-offset-4">
        Saisir ce repas à la main
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- */

function Revue({
  analyse, lignes, setLignes, photo, avaitTexte, onRetour, onDone,
}: {
  analyse: Analyse
  lignes: LigneRevue[]
  setLignes: React.Dispatch<React.SetStateAction<LigneRevue[]>>
  photo: PhotoPrete | null
  avaitTexte: boolean
  onRetour: () => void
  onDone: () => void
}) {
  const [titre, setTitre] = useState(analyse.titre)
  const [when, setWhen] = useState(() => toLocalInput(new Date()))
  const [mealType, setMealType] = useState<MealType>(() => guessMealType(new Date()))
  const [mealTouched, setMealTouched] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [aChoisir, setAChoisir] = useState<string | null>(null)

  const eatenAt = useMemo(() => new Date(when), [when])
  useEffect(() => {
    if (!mealTouched && !Number.isNaN(eatenAt.getTime())) setMealType(guessMealType(eatenAt))
  }, [eatenAt, mealTouched])

  const retenues = lignes.filter((l) => macrosDeLaLigne(l) !== null)
  const total = retenues.length
    ? sumMacros(retenues.map((l) => macrosDeLaLigne(l)!))
    : emptyMacros()

  const maj = (key: string, f: (l: LigneRevue) => LigneRevue) =>
    setLignes((xs) => xs.map((l) => (l.key === key ? f(l) : l)))

  const arbitragesEnAttente = lignes.filter((l) => l.besoinArbitrage && l.produitChoisi === null)

  async function enregistrer() {
    if (retenues.length === 0) return
    setEnCours(true)
    setErreur(null)
    try {
      let chemin: string | null = null
      if (photo) chemin = await envoyerPhoto(photo.blob)

      const items: DraftItem[] = retenues.map((l) => {
        const m = macrosDeLaLigne(l)!
        return {
          key: l.key,
          label: libelleSource(l),
          food_id: l.produitChoisi ? null : (l.aliment?.id ?? null),
          quantity_g: l.grammes,
          quantity_display: null,
          quantity_source: l.origine,
          confidence: l.detecte.confiance ?? null,
          ai_raw: l.detecte,
          ...m,
        }
      })

      await saveEntry({
        eatenAt,
        mealType,
        title: titre.trim() || null,
        note: null,
        items,
        inputMethod: photo ? 'photo_plat' : 'texte',
        photoPath: chemin,
      })
      onDone()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Échec de l'enregistrement.")
      setEnCours(false)
    }
  }

  return (
    <Cadre titre="Vérifier" onRetour={onRetour}>
      <p className="mt-5 text-xs leading-relaxed text-cream-dim">
        Rien n'est enregistré tant que tu n'as pas validé. Corrige ce qui est faux :
        les poids que tu ajustes deviennent des valeurs pesées.
      </p>

      <input
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        placeholder="Intitulé du repas"
        className="mt-5 w-full rounded-xl border border-ink-line bg-ink-soft px-4 py-3
                   text-base outline-none placeholder:text-cream-dim/50 focus:border-food"
      />

      <input
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="mt-3 w-full rounded-xl border border-ink-line bg-ink-soft px-4 py-3
                   text-base outline-none focus:border-food"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {MEAL_ORDER.map((m) => (
          <button key={m} onClick={() => { setMealType(m); setMealTouched(true) }}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              mealType === m ? 'bg-food text-ink' : 'border border-ink-line text-cream-dim'}`}>
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      {analyse.incertitudes.length > 0 && (
        <div className="mt-6 rounded-2xl border border-warn/30 bg-warn/5 p-4">
          <p className="text-xs font-medium tracking-wide text-warn uppercase">
            Ce dont je ne suis pas sûr
          </p>
          <ul className="mt-2 space-y-1.5">
            {analyse.incertitudes.map((u, i) => (
              <li key={i} className="text-xs leading-relaxed text-cream-dim">· {u}</li>
            ))}
          </ul>
        </div>
      )}

      {arbitragesEnAttente.length > 0 && (
        <p className="mt-4 rounded-xl border border-ink-line px-4 py-3 text-xs leading-relaxed text-cream-dim">
          Plusieurs de tes produits pourraient correspondre. Choisis lequel, ou laisse les
          valeurs génériques.
        </p>
      )}

      {lignes.length === 0 ? (
        <p className="mt-8 text-sm leading-relaxed text-cream-dim">
          Aucun aliment reconnu. Reprends la photo, ou décris le repas en mots.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {lignes.map((l) => (
            <LigneUI
              key={l.key}
              ligne={l}
              onGrammes={(g) => maj(l.key, (x) => ({ ...x, grammes: g, origine: 'pese' }))}
              onProduit={(id) => maj(l.key, (x) => ({ ...x, produitChoisi: id }))}
              onChanger={() => setAChoisir(l.key)}
              onRetirer={() => setLignes((xs) => xs.filter((x) => x.key !== l.key))}
            />
          ))}
        </ul>
      )}

      {erreur && <p className="mt-4 text-sm text-bad">{erreur}</p>}

      {retenues.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-ink-line bg-ink/95 backdrop-blur"
             style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto max-w-md px-5 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">{total.kcal} kcal</span>
              <span className="text-xs text-cream-dim tabular-nums">
                P {total.protein_g} · G {total.carb_g} · L {total.fat_g}
              </span>
            </div>
            <button onClick={enregistrer} disabled={enCours}
              className="mt-3 w-full rounded-xl bg-food px-4 py-3.5 text-base font-medium text-ink disabled:opacity-40">
              {enCours ? 'Enregistrement…' : `Enregistrer${photo ? ' avec la photo' : ''}`}
            </button>
            {!photo && avaitTexte && (
              <p className="pt-2 text-center text-[11px] text-cream-dim">D'après ta description seule.</p>
            )}
          </div>
        </div>
      )}

      {aChoisir && (
        <ChoixAliment
          ligne={lignes.find((l) => l.key === aChoisir)!}
          onClose={() => setAChoisir(null)}
          onChoisir={(f) => {
            maj(aChoisir, (x) => ({ ...x, aliment: f, produits: [], produitChoisi: null, besoinArbitrage: false }))
            setAChoisir(null)
          }}
        />
      )}
    </Cadre>
  )
}

function LigneUI({ ligne, onGrammes, onProduit, onChanger, onRetirer }: {
  ligne: LigneRevue
  onGrammes: (g: number) => void
  onProduit: (id: number | null) => void
  onChanger: () => void
  onRetirer: () => void
}) {
  const m = macrosDeLaLigne(ligne)
  const confiance = Math.round(num(ligne.detecte.confiance) * 100)

  return (
    <li className="rounded-2xl border border-ink-line bg-ink-soft/60 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm leading-snug first-letter:uppercase">
          {ligne.detecte.libelle}
        </p>
        <p className="shrink-0 text-sm tabular-nums">{m ? `${m.kcal} kcal` : '—'}</p>
      </div>

      {/* D'ou viennent les chiffres */}
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-cream-dim">{libelleSource(ligne)}</p>
        <button onClick={onChanger} className="shrink-0 text-xs text-cream-dim underline underline-offset-2">
          changer
        </button>
      </div>

      {ligne.produits.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => onProduit(null)}
            className={`rounded-full px-3 py-1 text-xs ${
              ligne.produitChoisi === null ? 'bg-food text-ink' : 'border border-ink-line text-cream-dim'}`}>
            générique
          </button>
          {ligne.produits.map((p) => (
            <button key={p.id} onClick={() => onProduit(p.id)}
              className={`rounded-full px-3 py-1 text-xs ${
                ligne.produitChoisi === p.id ? 'bg-food text-ink' : 'border border-ink-line text-cream-dim'}`}>
              {[p.brand, p.kind ?? p.name].filter(Boolean).join(' ')}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={String(ligne.grammes)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(',', '.'))
            onGrammes(Number.isFinite(n) && n >= 0 ? n : 0)
          }}
          className="w-24 rounded-xl border border-ink-line bg-ink px-3 py-2 text-base
                     tabular-nums outline-none focus:border-food"
        />
        <span className="text-sm text-cream-dim">g</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${
          ligne.origine === 'pese' ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'}`}>
          {ligne.origine === 'pese' ? 'pesé' : 'estimé'}
        </span>
        {ligne.origine === 'estime' && confiance > 0 && (
          <span className="text-[11px] text-cream-dim">confiance {confiance} %</span>
        )}
        <button onClick={onRetirer} className="ml-auto text-xs text-cream-dim underline underline-offset-2">
          retirer
        </button>
      </div>

      {!ligne.aliment && (
        <p className="mt-2 text-xs text-bad">
          Aucun aliment de référence trouvé. Touche « changer » pour en choisir un.
        </p>
      )}
    </li>
  )
}

function ChoixAliment({ ligne, onChoisir, onClose }: {
  ligne: LigneRevue
  onChoisir: (f: Food) => void
  onClose: () => void
}) {
  const [q, setQ] = useState(ligne.detecte.aliment_generique)
  const [res, setRes] = useState<Food[]>(ligne.alternatives)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) return
    let vivant = true
    setBusy(true)
    const t = setTimeout(() => {
      searchFoods(q)
        .then((r) => { if (vivant) setRes(r) })
        .catch(() => { if (vivant) setRes([]) })
        .finally(() => { if (vivant) setBusy(false) })
    }, 220)
    return () => { vivant = false; clearTimeout(t) }
  }, [q])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink">
      <div className="mx-auto max-w-md px-5 pb-16"
           style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="-ml-1 px-1 py-2 text-sm text-cream-dim">← Retour</button>
          <h2 className="text-sm font-medium">Choisir l'aliment</h2>
          <span className="w-16" />
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-5 w-full rounded-xl border border-ink-line bg-ink-soft px-4 py-3
                     text-base outline-none focus:border-food"
        />
        {busy && <p className="mt-4 text-sm text-cream-dim">Recherche…</p>}
        <ul className="mt-4 divide-y divide-ink-line/60">
          {res.map((f) => (
            <li key={f.id}>
              <button onClick={() => onChoisir(f)} className="w-full py-3 text-left">
                <p className="text-sm leading-snug">{f.name}</p>
                <p className="mt-0.5 text-xs text-cream-dim tabular-nums">
                  {Math.round(num(f.kcal))} kcal / 100 g
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
