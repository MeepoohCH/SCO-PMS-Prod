'use client'

import { SLApp } from '../screens/SL'

export default function SLPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6 md:p-10">
      <div className="w-full max-w-7xl mx-auto">
        <SLApp />
      </div>
    </main>
  )
}