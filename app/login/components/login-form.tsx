import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface LoginFormProps {
  onForgotPassword: () => void
  onForceChange: (username: string) => void
}

const inputCls = 'w-full h-12 px-4 text-base border-[1.5px] border-[#DDE2EE] rounded-xl bg-gray-50 outline-none focus:border-[#0F2347] transition-colors placeholder:text-gray-300'
const labelCls = 'block text-sm font-semibold text-[#0F2347] mb-2'

export default function LoginForm({ onForgotPassword, onForceChange }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin() {
    if (!username || !password) {
      setError('กรุณากรอก Username และ Password')
      return
    }
    setLoading(true)
    setError('')

    const result = await signIn('credentials', { username, password, redirect: false })
    if (result?.error) {
      setError('Username หรือ Password ไม่ถูกต้อง')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/session')
      const session = await res.json() as { user?: { role?: string; force_change_password?: boolean } }

      if (session?.user?.force_change_password) {
        onForceChange(username)
        return
      }

      const role = session?.user?.role ?? ''
      const routes: Record<string, string> = { admin: '/admin', sl: '/sl', pl: '/pl', packer: '/packer', staff: '/staff' }
      router.replace(routes[role] ?? '/login')
    } catch {
      router.replace('/login')
    }
  }

  return (
    <>
      <h2 className="text-2xl font-black text-[#0F2347] mb-1">เข้าสู่ระบบ</h2>
      <p className="text-sm text-gray-400 mb-5">Dow Packing Web-Based System</p>

      <div className="mb-5">
        <label className={labelCls}>Username</label>
        <input
          value={username}
          onChange={e => { setUsername(e.target.value); setError('') }}
          placeholder="กรอกชื่อผู้ใช้"
          className={inputCls}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
      </div>

      <div className="mb-5">
        <label className={labelCls}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          placeholder="กรอกรหัสผ่าน"
          className={inputCls}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 mb-4 text-center">
          {error}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={!username || !password || loading}
        className="w-full h-14 rounded-xl text-base font-bold text-white bg-[#CC0000] hover:bg-[#B30000] disabled:bg-gray-200 disabled:text-gray-400 transition-colors cursor-pointer disabled:cursor-default"
      >
        {loading ? 'กำลังเข้าระบบ…' : 'Sign in'}
      </button>

      {/* <button type="button" onClick={onForgotPassword} className="text-sm font-semibold text-[#0F2347] hover:underline block mx-auto mt-5">
        ลืมรหัสผ่าน?
      </button> */}

      <p className="text-[13px] text-gray-400 text-center mt-5 leading-relaxed">
        ติดต่อ Admin เพื่อรีเซ็ตรหัสผ่าน
      </p>
    </>
  )
}