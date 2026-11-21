import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './lib/supabase'
import Auth from './screens/Auth'
import Today from './screens/Today'
import AddEntry from './screens/AddEntry'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<'journal' | 'ajout'>('journal')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!supabase) { setReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <h1 className="text-2xl font-semibold">Miamee</h1>
        <p className="mt-3 text-sm leading-relaxed text-bad">
          Configuration Supabase absente de cette compilation.
        </p>
      </div>
    )
  }

  if (!ready) {
    return <div className="mx-auto max-w-md px-6 py-20 text-sm text-cream-dim">Chargement…</div>
  }

  if (!session) return <Auth />

  if (view === 'ajout') {
    return (
      <AddEntry
        onCancel={() => setView('journal')}
        onDone={() => { setReloadKey((k) => k + 1); setView('journal') }}
      />
    )
  }

  return (
    <Today
      key={reloadKey}
      onAdd={() => setView('ajout')}
      onSignOut={() => supabase?.auth.signOut()}
    />
  )
}
