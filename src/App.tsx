import { useEffect, useState } from 'react'
import { supabaseConfigured, supabaseUrl } from './lib/supabase'

type Status = 'attente' | 'ok' | 'avertissement' | 'echec'

type Check = {
  id: string
  label: string
  status: Status
  detail: string
}

const DOT: Record<Status, string> = {
  attente: 'bg-cream-dim/40',
  ok: 'bg-ok',
  avertissement: 'bg-warn',
  echec: 'bg-bad',
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // Safari iOS expose son propre drapeau, hors standard.
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

async function runChecks(): Promise<Check[]> {
  const out: Check[] = []

  out.push({
    id: 'install',
    label: "Installée sur l'écran d'accueil",
    status: isStandalone() ? 'ok' : 'avertissement',
    detail: isStandalone()
      ? 'Lancée en mode plein écran.'
      : "Ouverte dans Safari. Partager → « Sur l'écran d'accueil » pour l'installer.",
  })

  const sw = 'serviceWorker' in navigator
  let swActive = false
  if (sw) {
    const reg = await navigator.serviceWorker.getRegistration()
    swActive = Boolean(reg?.active)
  }
  out.push({
    id: 'sw',
    label: 'Fonctionnement hors ligne',
    status: !sw ? 'echec' : swActive ? 'ok' : 'attente',
    detail: !sw
      ? 'Non pris en charge par ce navigateur.'
      : swActive
        ? 'Service worker actif, le cache est en place.'
        : "Service worker en cours d'installation. Recharge dans quelques secondes.",
  })

  const cam = Boolean(navigator.mediaDevices?.getUserMedia)
  out.push({
    id: 'camera',
    label: 'Appareil photo accessible',
    status: cam ? 'ok' : 'echec',
    detail: cam
      ? "Interface disponible. L'autorisation sera demandée à la première photo."
      : 'Aucune interface caméra. Vérifie que la page est servie en HTTPS.',
  })

  out.push({
    id: 'sb-config',
    label: 'Supabase configuré',
    status: supabaseConfigured ? 'ok' : 'echec',
    detail: supabaseConfigured
      ? new URL(supabaseUrl).host
      : 'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY absents de la compilation.',
  })

  if (supabaseConfigured) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`)
      out.push({
        id: 'sb-reach',
        label: 'Supabase joignable',
        status: res.ok ? 'ok' : 'echec',
        detail: res.ok ? `Service d'authentification en ligne (HTTP ${res.status}).` : `HTTP ${res.status}.`,
      })
    } catch (e) {
      out.push({
        id: 'sb-reach',
        label: 'Supabase joignable',
        status: 'echec',
        detail: e instanceof Error ? e.message : 'Échec du réseau.',
      })
    }
  }

  return out
}

export default function App() {
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    runChecks().then((c) => {
      if (!alive) return
      setChecks(c)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5"
         style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))',
                  paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
      <header className="mb-8">
        <div className="flex items-baseline gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">Miamee</h1>
          <span className="text-sm text-cream-dim">Phase 0</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-cream-dim">
          Journal alimentaire. Mesurer et documenter, rien de plus pour l'instant.
        </p>
      </header>

      <section className="rounded-2xl border border-ink-line bg-ink-soft/60 p-1">
        <h2 className="px-4 pt-3 pb-2 text-xs font-medium tracking-wide text-cream-dim uppercase">
          Diagnostic
        </h2>
        {loading ? (
          <p className="px-4 pb-4 text-sm text-cream-dim">Vérification…</p>
        ) : (
          <ul className="divide-y divide-ink-line/60">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-3 px-4 py-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.status]}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed break-words text-cream-dim">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs leading-relaxed text-cream-dim">
        Rien n'est encore enregistrable. La saisie manuelle arrive en phase 1, les photos en phases 3 et 4.
      </p>
    </div>
  )
}
