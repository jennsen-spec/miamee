import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'saisie' | 'envoi' | 'envoye'>('saisie')
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setState('envoi')
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      setError(error.message)
      setState('saisie')
    } else {
      setState('envoye')
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-5xl font-semibold tracking-tight">Miamee</h1>
      <p className="mt-3 text-sm leading-relaxed text-cream-dim">
        Ton journal alimentaire. Mesurer et documenter, rien de plus.
      </p>

      {state === 'envoye' ? (
        <div className="mt-10 rounded-2xl border border-ink-line bg-ink-soft/60 p-5">
          <p className="text-sm leading-relaxed">
            Un lien de connexion part vers <span className="text-food">{email}</span>.
            Ouvre-le depuis cet appareil.
          </p>
          <button
            onClick={() => setState('saisie')}
            className="mt-4 text-xs text-cream-dim underline underline-offset-4"
          >
            Utiliser une autre adresse
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="mt-10">
          <label htmlFor="email" className="block text-xs tracking-wide text-cream-dim uppercase">
            Adresse courriel
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-ink-line bg-ink-soft px-4 py-3.5
                       text-base outline-none focus:border-food"
          />
          <button
            type="submit"
            disabled={state === 'envoi' || email.trim().length < 3}
            className="mt-4 w-full rounded-xl bg-food px-4 py-3.5 text-base font-medium text-ink
                       disabled:opacity-40"
          >
            {state === 'envoi' ? 'Envoi…' : 'Recevoir un lien de connexion'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-cream-dim">
            Pas de mot de passe : tu reçois un lien à usage unique.
          </p>
          {error && <p className="mt-4 text-sm text-bad">{error}</p>}
        </form>
      )}
    </div>
  )
}
