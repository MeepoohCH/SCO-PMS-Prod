'use client'
import { useState } from 'react'

interface NewCredentialFormProps {
  username: string
  otp:      string
  onSuccess: () => void
}

const inputCls = 'w-full h-12 px-4 text-base border-[1.5px] border-[#DDE2EE] rounded-xl bg-gray-50 outline-none focus:border-[#0F2347] transition-colors'
const labelCls = 'block text-sm font-semibold text-[#0F2347] mb-2'

function validatePassword(pw: string): string | null {
  if (pw.length < 8)                                     return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
  if (!/[A-Z]/.test(pw))                                 return 'ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว'
  if (!/[0-9]/.test(pw))                                 return 'ต้องมีตัวเลขอย่างน้อย 1 ตัว'
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) return 'ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว เช่น !@#$'
  return null
}

export default function NewCredentialForm({ username, otp, onSuccess }: NewCredentialFormProps) {
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                   = useState('')
  const [loading, setLoading]               = useState(false)

  async function handleSubmit() {
    const pwError = validatePassword(password)
    if (pwError) { setError(pwError); return }
    if (password !== confirmPassword) {
      setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, otp, new_password: password }),
      })
      const data = await res.json() as { error?: string }
      if (res.ok) {
        onSuccess()
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  const strength = password ? validatePassword(password) : null

  return (
    <>
      <h2 className="text-2xl font-black text-[#0F2347] mb-1">New Credential</h2>
      <p className="text-sm text-gray-400 mb-8">กำหนดรหัสผ่านใหม่สำหรับเข้าใช้งานระบบ</p>

      <div className="mb-1">
        <label className={labelCls}>New Password</label>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          placeholder="กรอกรหัสผ่านใหม่"
          className={inputCls}
        />
      </div>
      {/* Strength hint */}
      <div className="mb-5 text-[11px] text-gray-400 leading-relaxed">
        ต้องมี: ตัวพิมพ์ใหญ่, ตัวเลข, อักขระพิเศษ (!@#$), ขั้นต่ำ 8 ตัว
        {password && (
          <span className={`ml-2 font-semibold ${strength ? 'text-red-500' : 'text-green-600'}`}>
            {strength ? '✗ ไม่ผ่าน' : '✓ ผ่าน'}
          </span>
        )}
      </div>

      <div className="mb-5">
        <label className={labelCls}>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => { setConfirmPassword(e.target.value); setError('') }}
          placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
          className={inputCls}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 mb-4 text-center">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleSubmit}
          disabled={!password || !confirmPassword || loading}
          className="w-full h-14 rounded-xl text-base font-bold text-white bg-[#CC0000] hover:bg-[#B30000] disabled:bg-gray-200 disabled:text-gray-400 transition-colors cursor-pointer"
        >
          {loading ? 'กำลังบันทึก…' : 'Submit'}
        </button>

        <button
          type="button"
          onClick={onSuccess}
          className="w-full h-14 rounded-xl text-base font-bold text-gray-500 border border-[#DDE2EE] bg-white hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
