'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { KeyRound, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface ForceChangePasswordProps {
  username:  string
  onSuccess: () => void
}

export default function ForceChangePassword({ username, onSuccess }: ForceChangePasswordProps) {
  const router = useRouter()
  const [current, setCurrent]   = useState('')
  const [newPw, setNewPw]       = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const rules = [
    { ok: newPw.length >= 8,            l: 'At least 8 characters' },
    { ok: /[A-Z]/.test(newPw),          l: 'At least 1 uppercase letter' },
    { ok: /[0-9]/.test(newPw),          l: 'At least 1 number' },
    { ok: newPw === confirm && confirm.length > 0, l: 'Passwords match' },
  ]
  const allOk = rules.every(r => r.ok)

  async function handleSubmit() {
    if (!allOk || !current) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: current,
          new_password: newPw
        }),
      })
      const data = await res.json() as { error?: string }
      if (res.ok) {
        // Re-sign in with new password to get fresh JWT
        const result = await signIn('credentials', {
          username,
          password: newPw,
          redirect: false
        })
        console.log('[ForceChange] signIn result:', result)
        if (result?.ok) {
          // Hard reload — ไม่ใช้ router.push เพราะ JWT ต้อง refresh
          window.location.href = '/'
        } else {
          setError('Login failed after password change. Please login again.')
          setTimeout(() => {
            window.location.href = '/login'
          }, 2000)
        }
      } else {
        setError(data.error ?? 'Failed to change password')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
          <KeyRound size={20} className="text-[#D97706]" />
        </div>
        <div>
          <div className="text-[18px] font-semibold text-[#0E1117]">Change Password Required</div>
          <div className="text-[12px] text-[#9BA3BA]">Admin has requested you to set a new password</div>
        </div>
      </div>

      {/* Warning banner */}
      <div className="bg-[#FEF3C7] border border-[#EF9F27] rounded-xl px-4 py-3 mb-5 flex gap-2.5">
        <AlertTriangle size={16} className="text-[#D97706] flex-shrink-0 mt-0.5" />
        <div className="text-[12px] text-[#633806]">
          You must change your password before continuing. This is a one-time requirement.
        </div>
      </div>

      {/* Current password */}
      <div className="mb-3">
        <label className="text-[12px] font-medium text-[#5A617A] mb-1.5 block">
          Current Password <span className="text-[#E24B4A]">*</span>
        </label>
        <input
          type="password"
          value={current}
          onChange={e => setCurrent(e.target.value)}
          placeholder="Enter current password"
          className="w-full h-12 px-4 text-sm border border-[#DDE2EE] rounded-xl outline-none focus:border-[#0F2347] box-border"
        />
      </div>

      {/* New password */}
      <div className="mb-3">
        <label className="text-[12px] font-medium text-[#5A617A] mb-1.5 block">
          New Password <span className="text-[#E24B4A]">*</span>
        </label>
        <input
          type="password"
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
          placeholder="Enter new password"
          className="w-full h-12 px-4 text-sm border border-[#DDE2EE] rounded-xl outline-none focus:border-[#0F2347] box-border"
        />
      </div>

      {/* Confirm password */}
      <div className="mb-4">
        <label className="text-[12px] font-medium text-[#5A617A] mb-1.5 block">
          Confirm Password <span className="text-[#E24B4A]">*</span>
        </label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className={`w-full h-12 px-4 text-sm border rounded-xl outline-none box-border ${
            confirm && newPw !== confirm ? 'border-[#E24B4A]' : 'border-[#DDE2EE] focus:border-[#0F2347]'
          }`}
        />
      </div>

      {/* Password rules */}
      <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-4 py-3 mb-4">
        <div className="text-[11px] font-semibold text-[#5A617A] mb-2 uppercase tracking-[0.06em]">
          Password Requirements
        </div>
        <div className="flex flex-col gap-1.5">
          {rules.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              {r.ok
                ? <CheckCircle2 size={13} className="text-[#27500A]" />
                : <div className="w-[13px] h-[13px] rounded-full border-2 border-[#DDE2EE] flex-shrink-0" />
              }
              <span className={`text-[11px] ${r.ok ? 'text-[#27500A] font-medium' : 'text-[#9BA3BA]'}`}>
                {r.l}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#FCEBEB] border border-[#E24B4A] rounded-xl px-4 py-3 mb-4 text-[12px] text-[#791F1F]">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!allOk || !current || loading}
        className="w-full h-12 rounded-xl text-sm font-semibold border-none transition-all"
        style={{
          background: allOk && current ? '#0F2347' : '#DDE2EE',
          color:      allOk && current ? '#fff'     : '#9BA3BA',
          cursor:     allOk && current ? 'pointer'  : 'not-allowed',
        }}
      >
        {loading ? 'Changing…' : 'Change Password & Continue'}
      </button>
    </>
  )
}
