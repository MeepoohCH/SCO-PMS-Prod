'use client'
import { useState, useEffect, useRef } from 'react'

interface OtpVerificationProps {
  email: string       // username passed from parent (prop name kept for compat)
  onBackToLogin: () => void
  onVerified: (otp: string) => void
}

export default function OtpVerification({ email, onBackToLogin, onVerified }: OtpVerificationProps) {
  const [otp, setOtp]           = useState<string[]>(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(15 * 60) // 15 minutes
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const inputRefs = useRef<HTMLInputElement[]>([])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs} mins`
  }

  const handleChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return
    const newOtp = [...otp]
    newOtp[index] = value.substring(value.length - 1)
    setOtp(newOtp)
    setError('')
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  async function handleVerify() {
    const otpStr = otp.join('')
    if (otpStr.length < 6) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/verify-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: email, otp: otpStr }),
      })
      const data = await res.json() as { valid?: boolean; error?: string }
      if (res.ok && data.valid) {
        onVerified(otpStr)
      } else {
        setError(data.error || 'OTP ไม่ถูกต้องหรือหมดอายุแล้ว')
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setOtp(['', '', '', '', '', ''])
    setError('')
    setCountdown(15 * 60)
    await fetch('/api/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: email }),
    })
    inputRefs.current[0]?.focus()
  }

  return (
    <>
      <h2 className="text-2xl font-black text-[#0F2347] mb-1">Code Verification</h2>
      <p className="text-sm text-gray-400 mb-6">
        Enter OTP sent to <span className="text-gray-700 font-medium">{email || 'your account'}</span>
      </p>

      <div className="flex justify-between gap-2 mb-2">
        {otp.map((digit, idx) => (
          <input
            key={idx}
            ref={el => { inputRefs.current[idx] = el! }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(e.target.value, idx)}
            onKeyDown={e => handleKeyDown(e, idx)}
            className="w-12 h-14 text-center text-xl font-bold border-[1.5px] border-[#DDE2EE] rounded-xl bg-gray-50 focus:border-[#0F2347] outline-none transition-colors"
          />
        ))}
      </div>

      <div className="text-right text-xs text-gray-400 font-semibold mb-2">
        {countdown > 0 ? formatTime(countdown) : 'OTP Expired'}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 mb-4 text-center">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleVerify}
          disabled={otp.some(d => !d) || loading || countdown === 0}
          className="w-full h-14 rounded-xl text-base font-bold text-white bg-[#CC0000] hover:bg-[#B30000] disabled:bg-gray-200 disabled:text-gray-400 transition-colors cursor-pointer"
        >
          {loading ? 'กำลังตรวจสอบ…' : 'Verify Code'}
        </button>

        <button
          type="button"
          disabled={countdown > 0}
          onClick={handleResend}
          className="w-full h-14 rounded-xl text-base font-bold text-[#0F2347] border border-[#DDE2EE] bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Resend Code
        </button>
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
