import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

let sessionCheckPromise

function getOrCreateSession() {
  if (!sessionCheckPromise) {
    sessionCheckPromise = (async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) throw error
      if (data.session) return data.session

      const { data: signInData, error: signInError } =
        await supabase.auth.signInAnonymously()

      if (signInError) throw signInError
      if (!signInData.session) {
        throw new Error('Nepavyko sukurti naudotojo sesijos.')
      }

      return signInData.session
    })().catch((error) => {
      sessionCheckPromise = undefined
      throw error
    })
  }

  return sessionCheckPromise
}

function App() {
  const [connectionState, setConnectionState] = useState('loading')
  const [connectionError, setConnectionError] = useState('')

  useEffect(() => {
    let isMounted = true

    getOrCreateSession()
      .then(() => {
        if (isMounted) setConnectionState('connected')
      })
      .catch((error) => {
        if (!isMounted) return
        setConnectionError(error.message || 'Patikrinkite interneto ryšį ir bandykite dar kartą.')
        setConnectionState('error')
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (connectionState === 'loading') {
    return <main className="page" aria-live="polite">Jungiamasi...</main>
  }

  if (connectionState === 'error') {
    return (
      <main className="page" role="alert">
        Nepavyko prisijungti prie Supabase: {connectionError}
      </main>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>
          <span className="title-icon" aria-hidden="true">✈</span>
          Mano kelionės
        </h1>
        <p className="connection-status">Prisijungta prie Supabase</p>
      </header>

      <section className="trips-section" aria-labelledby="trips-heading">
        <h2 id="trips-heading">Planuojamos kelionės</h2>
        <div className="empty-state">
          <p className="empty-title">Kol kas kelionių nėra</p>
          <p className="empty-description">Čia matysi savo būsimas keliones.</p>
        </div>
      </section>
    </main>
  )
}

export default App
