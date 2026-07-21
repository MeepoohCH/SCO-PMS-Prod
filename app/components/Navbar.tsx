'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import dowLogoImg from '../../public/dow-logo.png'
import { ConfirmModal } from './shared'
import { LogOut } from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  sl: 'Site Logistics',
  pl: 'Pack Lead',
  packer: 'Packer',
  staff: 'Staff',
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#E24B4A',
  sl: '#185FA5',
  pl: '#534AB7',
  packer: '#0F6E56',
  staff: '#6B7280',
}

const ROLE_ROUTES: Record<string, string> = {
  admin: '/admin',
  sl: '/sl',
  pl: '/pl',
  packer: '/packer',
  staff: '/staff',
}

export default function Navbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showShiftEndConfirm, setShowShiftEndConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (pathname === '/login' || pathname === '/') return null
  if (status === 'loading' || !session?.user) return null

  const user = session.user as { full_name: string; role: string; roles?: string[] }
  const allRoles = user.roles?.length ? user.roles : [user.role]

  async function handleSignOut() {
    try {
      // เช็คเฉพาะตอนอยู่ใน /packer path
      if (pathname.startsWith('/packer')) {
        const res = await fetch('/api/lots?status=in_progress')
        if (res.ok) {
          const data = await res.json()
          const inProgress = (Array.isArray(data) ? data : []).filter(
            (l: any) => l.status === 'in_progress'
          )
          if (inProgress.length > 0) {
            setShowShiftEndConfirm(true)
            setIsUserMenuOpen(false)
            return
          }
        }
      }
    } catch (err) {
      console.error('[Navbar] handleSignOut error:', err)
    }
    signOut({ callbackUrl: '/login' })
  }

  async function confirmShiftEndAndSignOut() {
    setSigningOut(true)
    try {
      const res = await fetch('/api/lots?status=in_progress')
      if (res.ok) {
        const data = await res.json()
        const inProgress = (Array.isArray(data) ? data : []).filter(
          (l: any) => l.status === 'in_progress'
        )
        await Promise.all(inProgress.map((lot: any) =>
          fetch(`/api/lots/${lot.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paused_shift_end' }),
          })
        ))
      }
    } catch (err) {
      console.error('[Navbar] confirmShiftEndAndSignOut error:', err)
    } finally {
      await signOut({ callbackUrl: '/login' })
    }
  }

  function handleSwitchRole(newRole: string) {
    router.push(ROLE_ROUTES[newRole] ?? '/')
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).toUpperCase().replace(',', '')
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return (
    <>
    <header className="bg-[#0F2347] px-3 sm:px-4 h-16 flex items-center sticky top-0 z-50 justify-between shadow-lg border-b border-white/10 select-none">

      {/* ── ฝั่งซ้าย: โลโก้แบรนด์ขนาดใหญ่เด่นชัด ── */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-shrink-0">
        <div className="w-[72px] sm:w-[82px] flex-shrink-0 transition-transform duration-250 active:scale-95">
          <Image
            src={dowLogoImg}
            alt="DOW Logo"
            priority
            className="object-contain"
          />
        </div>

        {/* ชื่อระบบโชว์ตั้งแต่หน้าจอแท็บเล็ตเป็นต้นไป */}
        <span className="hidden sm:inline text-sm md:text-base font-bold text-white leading-tight truncate tracking-wide font-sans">
          <span className="hidden md:inline">Packing Web Base </span>
        </span>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {time && (
          <div className="flex flex-col items-end text-right sm:border-r sm:border-white/15 sm:pr-4 font-sans flex-shrink-0 select-none">
            <span className="text-[9px] sm:text-[10px] text-white/40 font-bold uppercase tracking-wider leading-none">
              {formatDate(time)}
            </span>
            <span className="text-xs sm:text-base font-bold text-white tracking-wide leading-none mt-1 sm:mt-1.5 antialiased font-['Segoe_UI',_Tahoma,_sans-serif]">
              {formatTime(time)}
            </span>
          </div>
        )}

        <div className="flex items-center font-sans flex-shrink-0">
          {allRoles.length > 1 ? (
            <>
              <div className="hidden md:flex gap-1.5 bg-white/[0.04] p-1.5 rounded-full border border-white/10">
                {allRoles.map(r => {
                  const rolePath = ROLE_ROUTES[r] ?? ''
                  const isActive = rolePath !== '' && pathname.startsWith(rolePath)
                  const roleColor = ROLE_COLORS[r] ?? '#0F2347'

                  return (
                    <button
                      key={r}
                      onClick={() => handleSwitchRole(r)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold border-[1.5px] min-h-[32px] cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                      style={{
                        background: isActive ? '#fff' : 'rgba(255,255,255,0.08)',
                        color: isActive ? roleColor : 'rgba(255,255,255,0.90)',
                        borderColor: isActive ? '#fff' : 'rgba(255,255,255,0.25)',
                      }}
                    >
                      {ROLE_LABELS[r] ?? r}
                    </button>
                  )
                })}
              </div>

              <div className="md:hidden relative">
                <select
                  value={allRoles.find(r => pathname.startsWith(ROLE_ROUTES[r] ?? '')) || user.role}
                  onChange={(e) => handleSwitchRole(e.target.value)}
                  className="bg-white/10 border border-white/25 text-white text-xs font-bold rounded-full px-3 py-1.5 pr-7 appearance-none focus:outline-none"
                >
                  {allRoles.map(r => (
                    <option key={r} value={r} className="text-slate-900 font-bold">
                      {ROLE_LABELS[r] ?? r}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-white/60">
                  <svg className="fill-current h-3.5 w-3.5" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </>
          ) : (
            /* กรณีมี Role เดียว */
            <span
              className="text-xs font-bold rounded-full px-3.5 py-1 bg-white/[0.08] border-[1.5px] border-white/25 whitespace-nowrap"
              style={{ color: ROLE_COLORS[user.role] ?? '#fff' }}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          )}
        </div>

        {/* ส่วนผู้ใช้ Profile Avatar ทรงกลมลอยตัว */}
        <div className="relative flex-shrink-0 font-sans">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 bg-transparent lg:bg-white/[0.06] lg:hover:bg-white/10 lg:border lg:border-white/10 rounded-full lg:p-1.5 lg:pr-3 transition-all focus:outline-none active:scale-95"
          >
            <div className="w-8 h-8 rounded-full bg-[#EF9F27] flex items-center justify-center font-black text-slate-950 text-sm shadow-md transition-transform hover:scale-105">
              {user.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>

            <span className="text-sm text-white/90 hidden lg:block max-w-[120px] truncate font-bold">
              {user.full_name}
            </span>

            <svg className={`w-3.5 h-3.5 text-white/40 hidden lg:block transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isUserMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>

              <div className="absolute right-0 mt-2.5 w-48 bg-white rounded-xl shadow-2xl py-1.5 z-20 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-100">
                <div className="px-4 py-2 border-b border-slate-100 lg:hidden">
                  <p className="text-xs text-slate-400">Current User</p>
                  <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{user.full_name}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-[#CC0000] hover:bg-red-50 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </header>
    <ConfirmModal
      open={showShiftEndConfirm}
      title="ออกจากงานตอนนี้?"
      message={'ระบบจะบันทึกเป็น "Shift End" โดยอัตโนมัติ ข้อมูลที่กรอกไว้จะถูก autosave และพนักงานคนต่อไปสามารถกด Resume เพื่อทำงานต่อได้'}
      confirmLabel={signingOut ? 'กำลังบันทึก...' : 'ยืนยันออกจากงาน'}
      cancelLabel="ยกเลิก"
      confirmColor="#EF9F27"
      icon={<LogOut size={44} />}
      onCancel={() => setShowShiftEndConfirm(false)}
      onConfirm={confirmShiftEndAndSignOut}
    />
    </>
  )
}