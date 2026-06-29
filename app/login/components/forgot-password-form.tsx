'use client'
import { useState } from 'react'

interface ForgotPasswordFormProps {
  onBackToLogin: () => void
  onEmailSubmitted: (username: string) => void
}

export default function ForgotPasswordForm({ onBackToLogin, onEmailSubmitted }: ForgotPasswordFormProps) {
  const [username, setUsername] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSend() {
    if (!username.trim()) {
      setError('กรุณากรอก Username')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: username.trim() }),
      })
      const data = await res.json() as { error?: string; dev_otp?: string }
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        return
      }
      // TODO: Remove dev_otp display in production
      if (data.dev_otp) console.log('[DEV] OTP:', data.dev_otp)
      onEmailSubmitted(username.trim())
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 className="text-2xl font-black text-[#0F2347] mb-1">ลืมรหัสผ่าน</h2>
      <p className="text-sm text-gray-400 mb-8">กรอก Email เพื่อรับ OTP รีเซ็ตรหัสผ่าน</p>

      <div className="mb-5">
        <label className="block text-sm font-semibold text-[#0F2347] mb-2">Email</label>
        <input
          type="email"
          value={username}
          onChange={e => { setUsername(e.target.value); setError('') }}
          placeholder="กรอก Email ของคุณ"
          className="w-full h-12 px-4 text-base border-[1.5px] border-[#DDE2EE] rounded-xl bg-gray-50 outline-none focus:border-[#0F2347] transition-colors placeholder:text-gray-300"
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 mb-4 text-center">
          {error}
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={!username.trim() || loading}
        className="w-full h-14 rounded-xl text-base font-bold text-white bg-[#CC0000] hover:bg-[#B30000] disabled:bg-gray-200 disabled:text-gray-400 transition-colors cursor-pointer"
      >
        {loading ? 'กำลังส่ง OTP…' : 'Send OTP'}
      </button>

      <div className="mt-5 p-4 bg-red-50/60 border border-red-100 rounded-xl flex gap-3">
        <span className="text-red-500 font-bold text-sm">ⓘ</span>
        <div className="text-xs text-red-800 leading-relaxed">
          <p className="font-bold mb-0.5">สำหรับ Contractor</p>
          <p className="text-red-700/90">Contractor ไม่สามารถรีเซ็ตรหัสผ่านด้วยตัวเองได้ กรุณาติดต่อ Admin เพื่อรีเซ็ตรหัสผ่าน</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onBackToLogin}
        className="text-sm font-semibold text-gray-500 hover:text-[#0F2347] flex items-center justify-center gap-2 mx-auto mt-6"
      >
        ← กลับไปหน้า Sign in
      </button>
    </>
  )
}
