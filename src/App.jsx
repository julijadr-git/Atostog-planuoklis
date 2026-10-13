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
  const [trips, setTrips] = useState([])
  const [tripsState, setTripsState] = useState('loading')
  const [tripsError, setTripsError] = useState('')
  const [placesError, setPlacesError] = useState('')
  const [placeInputs, setPlaceInputs] = useState({})
  const [placeSaving, setPlaceSaving] = useState({})
  const [placeSaveErrors, setPlaceSaveErrors] = useState({})
  const [tripForm, setTripForm] = useState({
    name: '',
    country: '',
    start_date: '',
    end_date: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let isMounted = true

    getOrCreateSession()
      .then(async (session) => {
        if (!isMounted) return

        setConnectionState('connected')

        try {
          await loadTrips(session.user.id, () => isMounted)
        } catch (error) {
          if (!isMounted) return
          setTripsError(error.message || 'Patikrinkite ryšį ir bandykite dar kartą.')
          setTripsState('error')
        }
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

  function handleTripFieldChange(event) {
    const { name, value } = event.target
    setTripForm((currentForm) => ({ ...currentForm, [name]: value }))
    setSaveError('')
  }

  async function handleTripSubmit(event) {
    event.preventDefault()
    setSaveError('')
    setIsSaving(true)

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) throw sessionError
      if (!sessionData.session) {
        throw new Error('Naudotojo sesija nerasta. Atnaujinkite puslapį ir bandykite dar kartą.')
      }

      const { error } = await supabase.from('trips').insert({
        name: tripForm.name.trim(),
        country: tripForm.country.trim(),
        start_date: tripForm.start_date,
        end_date: tripForm.end_date,
        user_id: sessionData.session.user.id,
      })

      if (error) throw error

      setTripForm({ name: '', country: '', start_date: '', end_date: '' })
      await loadTrips(sessionData.session.user.id)
    } catch (error) {
      setSaveError(error.message || 'Nepavyko išsaugoti kelionės. Bandykite dar kartą.')
    } finally {
      setIsSaving(false)
    }
  }

  async function loadTrips(userId, isActive = () => true) {
    setTripsState('loading')
    setTripsError('')
    setPlacesError('')

    const { data, error } = await supabase
      .from('trips')
      .select('id, name, country, start_date, end_date, places(id, name)')
      .eq('user_id', userId)
      .order('start_date', { ascending: true })

    if (!isActive()) return

    if (error) {
      setTripsError(error.message || 'Patikrinkite ryšį ir bandykite dar kartą.')
      setTripsState('error')
      return
    }

    const tripsWithPlaces = (data ?? []).map((trip) => {
      if (Array.isArray(trip.places)) return trip

      setPlacesError('Lankytinų vietų nepavyko nuskaityti. Patikrinkite lentelių ryšį ir RLS taisykles.')
      return { ...trip, places: [] }
    })

    setTrips(tripsWithPlaces)
    setTripsState('loaded')
  }

  async function handlePlaceSubmit(event, trip) {
    event.preventDefault()
    const name = (placeInputs[trip.id] ?? '').trim()
    if (!name || placeSaving[trip.id]) return

    setPlaceSaving((current) => ({ ...current, [trip.id]: true }))
    setPlaceSaveErrors((current) => ({ ...current, [trip.id]: '' }))

    try {
      const { data, error } = await supabase
        .from('places')
        .insert({ name, trip_id: trip.id })
        .select('id, name')
        .single()

      if (error) throw error

      setTrips((currentTrips) => currentTrips.map((currentTrip) => (
        currentTrip.id === trip.id
          ? { ...currentTrip, places: [...currentTrip.places, data] }
          : currentTrip
      )))
      setPlaceInputs((current) => ({ ...current, [trip.id]: '' }))
    } catch (error) {
      setPlaceSaveErrors((current) => ({
        ...current,
        [trip.id]: error.message || 'Nepavyko pridėti lankytinos vietos. Bandykite dar kartą.',
      }))
    } finally {
      setPlaceSaving((current) => ({ ...current, [trip.id]: false }))
    }
  }

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

      <section className="form-section" aria-labelledby="new-trip-heading">
        <h2 id="new-trip-heading">Nauja kelionė</h2>
        <form className="trip-form" onSubmit={handleTripSubmit}>
          <label>
            Kelionės pavadinimas
            <input
              name="name"
              type="text"
              value={tripForm.name}
              onChange={handleTripFieldChange}
              required
            />
          </label>
          <label>
            Šalis
            <input
              name="country"
              type="text"
              value={tripForm.country}
              onChange={handleTripFieldChange}
              required
            />
          </label>
          <label>
            Pradžios data
            <input
              name="start_date"
              type="date"
              value={tripForm.start_date}
              max={tripForm.end_date || undefined}
              onChange={handleTripFieldChange}
              required
            />
          </label>
          <label>
            Pabaigos data
            <input
              name="end_date"
              type="date"
              value={tripForm.end_date}
              min={tripForm.start_date || undefined}
              onChange={handleTripFieldChange}
              required
            />
          </label>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <button className="save-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Saugoma...' : 'Išsaugoti kelionę'}
          </button>
        </form>
      </section>

      <section className="trips-section" aria-labelledby="trips-heading">
        <h2 id="trips-heading">Planuojamos kelionės</h2>
        {tripsState === 'loading' && (
          <p className="trips-message" aria-live="polite">Kraunamos kelionės...</p>
        )}
        {tripsState === 'error' && (
          <p className="trips-message trips-error" role="alert">
            Nepavyko įkelti kelionių: {tripsError}
          </p>
        )}
        {tripsState === 'loaded' && trips.length === 0 && (
          <div className="empty-state">
            <p className="empty-title">Kol kas kelionių nėra</p>
            <p className="empty-description">Čia matysi savo būsimas keliones.</p>
          </div>
        )}
        {tripsState === 'loaded' && trips.length > 0 && (
          <div className="trip-list">
            {trips.map((trip) => (
              <article className="trip-card" key={trip.id}>
                <h3>{trip.name}</h3>
                <p className="trip-country">{trip.country}</p>
                <p className="trip-dates">
                  {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
                </p>
                <section className="places-section" aria-label={`Kelionės „${trip.name}“ lankytinos vietos`}>
                  <h4>Lankytinos vietos</h4>
                  {placesError && (
                    <p className="places-error" role="alert">{placesError}</p>
                  )}
                  {!placesError && trip.places.length === 0 && (
                    <p className="places-empty">Lankytinų vietų dar nėra</p>
                  )}
                  {!placesError && trip.places.length > 0 && (
                    <ul className="places-list">
                      {trip.places.map((place) => (
                        <li key={place.id}>{place.name}</li>
                      ))}
                    </ul>
                  )}
                  <form
                    className="place-form"
                    onSubmit={(event) => handlePlaceSubmit(event, trip)}
                  >
                    <input
                      type="text"
                      value={placeInputs[trip.id] ?? ''}
                      onChange={(event) => {
                        const { value } = event.target
                        setPlaceInputs((current) => ({ ...current, [trip.id]: value }))
                        setPlaceSaveErrors((current) => ({ ...current, [trip.id]: '' }))
                      }}
                      placeholder="Vietos pavadinimas"
                      aria-label={`Vietos pavadinimas kelionei ${trip.name}`}
                      required
                    />
                    <button
                      className="add-place-button"
                      type="submit"
                      disabled={placeSaving[trip.id] || !(placeInputs[trip.id] ?? '').trim()}
                    >
                      {placeSaving[trip.id] ? 'Pridedama...' : 'Pridėti'}
                    </button>
                  </form>
                  {placeSaveErrors[trip.id] && (
                    <p className="places-error" role="alert">{placeSaveErrors[trip.id]}</p>
                  )}
                </section>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function formatDate(date) {
  if (!date) return '—'

  return new Intl.DateTimeFormat('lt-LT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export default App
