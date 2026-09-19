'use client'

import { useState } from 'react'

export function CopiarLinkPortal() {
  const [copiado, setCopiado] = useState(false)

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/portal/register`
    : '/portal/register'

  function copiar() {
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <button
      onClick={copiar}
      className="shrink-0 text-xs font-medium text-violet-700 border border-violet-300 bg-white hover:bg-violet-50 rounded-full px-4 py-2 transition-colors"
    >
      {copiado ? '¡Copiado!' : 'Copiar link'}
    </button>
  )
}
