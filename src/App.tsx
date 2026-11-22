import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './lib/supabase'
import Today from './screens/Today'
import AddEntry from './screens/AddEntry'
import PhotoRepas from './screens/PhotoRepas'

const DASHBOARD =
  'https://supabase.com/dashboard/project/mhmyjsndtxkzouiwvjly/auth/providers'

type Etat = 'chargement' | 'pret' | 'a_activer' | 'erreur'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [etat, setEtat] = useState<Etat>('chargement')
  const [message, setMessage] = useState<string | null>(null)
  const [view, setView] = useState<'journal' | 'photo' | 'manuel'>('journal')
  const [reloadKey, setReloadKey] = useState(0)
  const tentee = useRef(false)

  useEffect(() => {
    if (!supabase) { setEtat('erreur'); setMessage('Configuration Supabase absente.'); return }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) setEtat('pret')
    })

    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setSession(data.session)
        setEtat('pret')
        return
      }
      // Aucun compte sur cet appareil : on en ouvre un, sans rien demander.
      if (tentee.current) return
      tentee.current = true
      const { error } = await supabase.auth.signInAnonymously()
      if (!error) return                       // onAuthStateChange prend le relais
      if (error.code === 'anonymous_provider_disabled') setEtat('a_activer')
      else { setEtat('erreur'); setMessage(error.message) }
    })()

    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured || etat === 'erreur') {
    return (
      <Ecran titre="Miamee">
        <p className="mt-3 text-sm leading-relaxed text-bad">
          {message ?? 'Configuration Supabase absente de cette compilation.'}
        </p>
      </Ecran>
    )
  }

  if (etat === 'a_activer') {
    return (
      <Ecran titre="Miamee">
        <p className="mt-3 text-sm leading-relaxed text-cream-dim">
          Une dernière bascule à activer, puis tu n'auras plus jamais rien à faire :
        </p>
        <ol className="mt-5 space-y-3 text-sm leading-relaxed">
          <li>
            <a href={DASHBOARD} className="text-food underline underline-offset-4">
              Ouvre les fournisseurs d'authentification
            </a>{' '}
            de ton projet Supabase.
          </li>
          <li>Trouve <span className="text-cream">Anonymous sign-ins</span> et active-le.</li>
          <li>Reviens ici et recharge la page.</li>
        </ol>
        <p className="mt-6 text-xs leading-relaxed text-cream-dim">
          Cela permet à l'app de t'ouvrir un compte silencieusement, sans courriel ni mot de
          passe. Tes données restent privées : personne d'autre ne peut les lire.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full rounded-xl bg-food px-4 py-3.5 text-base font-medium text-ink"
        >
          J'ai activé, recharger
        </button>
      </Ecran>
    )
  }

  if (etat === 'chargement' || !session) {
    return <Ecran titre="Miamee"><p className="mt-3 text-sm text-cream-dim">Ouverture…</p></Ecran>
  }

  const termine = () => { setReloadKey((k) => k + 1); setView('journal') }

  if (view === 'photo') {
    return (
      <PhotoRepas
        onCancel={() => setView('journal')}
        onManuel={() => setView('manuel')}
        onDone={termine}
      />
    )
  }

  if (view === 'manuel') {
    return <AddEntry onCancel={() => setView('journal')} onDone={termine} />
  }

  return (
    <Today
      key={reloadKey}
      onPhoto={() => setView('photo')}
      onManuel={() => setView('manuel')}
    />
  )
}

function Ecran({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">{titre}</h1>
      {children}
    </div>
  )
}
