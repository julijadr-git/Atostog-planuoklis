import './App.css'

function App() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>
          <span className="title-icon" aria-hidden="true">✈</span>
          Mano kelionės
        </h1>
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
