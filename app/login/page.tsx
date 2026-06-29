'use client'

import { useState } from 'react'
import LoginBanner from './components/login-banner'
import LoginForm from './components/login-form'
import ForgotPasswordForm from './components/forgot-password-form'
import OtpVerification from './components/otp-verification'
import NewCredentialForm from './components/new-credential-form'
import ForceChangePassword from './components/force-change-password'

type LoginStep = 'LOGIN' | 'FORGOT_PASSWORD' | 'OTP' | 'NEW_PASSWORD' | 'FORCE_CHANGE'

export default function LoginPage() {
  const [step, setStep]                   = useState<LoginStep>('LOGIN')
  const [emailForOtp, setEmailForOtp]     = useState('')
  const [verifiedOtp, setVerifiedOtp]     = useState('')
  const [loggedUsername, setLoggedUsername] = useState('')

  return (
    /* เปลี่ยนพื้นหลังนอกสุดของหน้าจอทั้งหมดให้เป็นสีเทาอ่อน #F3F4F6 เพื่อขับให้การ์ดสีขาวเด่นขึ้น */
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col lg:flex-row font-sans selection:bg-[#0F2347]/10">

      <LoginBanner />

      {/* 🎯 จัดการ Container สลัดความกว้างและดึงระยะ Margin ติดลบเพื่อเกยทับ */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 relative z-10
        -mt-14 sm:-mt-20 md:-mt-24 lg:mt-0 py-6 lg:py-0"
      >
        {/* ตัวการ์ดสีขาวล็อกให้เป็น bg-white ใส่เงาพรีเมียม (shadow-xl) และเส้นขอบจางๆ */}
        <div className="w-full max-w-md bg-white p-6 sm:p-10 rounded-2xl shadow-xl lg:shadow-sm border border-slate-100 transition-all duration-300">

          {step === 'LOGIN' && (
            <LoginForm
              onForgotPassword={() => setStep('FORGOT_PASSWORD')}
              onForceChange={(u) => { setLoggedUsername(u); setStep('FORCE_CHANGE') }}
            />
          )}

          {step === 'FORCE_CHANGE' && (
            <ForceChangePassword
              username={loggedUsername}
              onSuccess={() => { window.location.href = '/' }}
            />
          )}

          {step === 'FORGOT_PASSWORD' && (
            <ForgotPasswordForm
              onBackToLogin={() => setStep('LOGIN')}
              onEmailSubmitted={(username) => {
                setEmailForOtp(username)
                setStep('OTP')
              }}
            />
          )}

          {step === 'OTP' && (
            <OtpVerification
              email={emailForOtp}
              onBackToLogin={() => setStep('LOGIN')}
              onVerified={(otp) => {
                setVerifiedOtp(otp)
                setStep('NEW_PASSWORD')
              }}
            />
          )}

          {step === 'NEW_PASSWORD' && (
            <NewCredentialForm
              username={emailForOtp}
              otp={verifiedOtp}
              onSuccess={() => {
                setStep('LOGIN')
                setEmailForOtp('')
                setVerifiedOtp('')
              }}
            />
          )}

        </div>
      </main>
    </div>
  )
}
