import { cookies } from 'next/headers'
import { AppShell } from '@/components/app/app-shell'

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const initialLang = cookieStore.get('ui-lang')?.value ?? 'en'
  return <AppShell initialLang={initialLang}>{children}</AppShell>
}
