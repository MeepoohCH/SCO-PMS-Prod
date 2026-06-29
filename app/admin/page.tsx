"use client";

import { useState, useEffect } from "react";
import AdminScreen, { Lot } from "../screens/Admin";
import { fetchAndFlattenLots } from "@/lib/fetchLots";

function Home() {
  const [lots, setLots] = useState<Lot[]>([]);

  useEffect(() => {
    fetchAndFlattenLots().then(data => setLots(data as Lot[])).catch(console.error)
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6 md:p-10">
     <div className="w-full max-w-7xl mx-auto">
        <AdminScreen lots={lots} setLots={setLots} />
      </div>
    </main>
  );
}

export default Home;