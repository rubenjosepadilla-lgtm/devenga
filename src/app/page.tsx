const PAISES = ['Chile', 'Perú', 'Colombia', 'México', 'Argentina']

const NO_HACE = [
  ['No calcula semana corrida, gratificación, CTS, SDI, SAC ni finiquito', 'Esos cálculos necesitan días trabajados, ausencias, licencias y topes que solo tiene la nómina.'],
  ['No emite liquidación de sueldo', 'Es documento de la nómina.'],
  ['No es CRM ni sistema de ventas', 'No origina la transacción.'],
  ['No paga', 'No mueve dinero.'],
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <span className="text-2xl font-bold text-violet-700">Motor de Comisiones</span>
        <div className="flex gap-2">
          {PAISES.map((p) => (
            <span key={p} className="text-xs font-medium text-gray-500 border border-gray-200 rounded-full px-3 py-1">
              {p}
            </span>
          ))}
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-8 py-24 text-center">
        <div className="inline-block bg-violet-50 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
          Fase 0 — dato maestro y clasificación legal
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Comisiones calculadas,<br />clasificadas y trazables
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Ingesta transacciones, calcula el incentivo según planes versionados, clasifica el
          resultado por país y lo entrega a cualquier nómina como movimientos de devengo
          inmutables, con expediente reproducible por operación.
        </p>
        <p className="text-sm text-gray-400">
          El motor clasifica e informa. La nómina calcula y paga.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-4 gap-6">
        {NO_HACE.map(([title, desc]) => (
          <div key={title} className="bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
