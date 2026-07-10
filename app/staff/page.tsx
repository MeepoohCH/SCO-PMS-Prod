import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import StaffScreen from '@/app/screens/Staff'

export default async function StaffPage() {
    const session = await auth()
    if (!session?.user) redirect('/login')
    const role = (session.user as any).role
    if (role !== 'staff' && role !== 'admin') redirect('/login')
    return (
        <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6 md:p-10">
            <div className="w-full max-w-7xl mx-auto">
                <StaffScreen />
            </div>
        </main>
    )
}