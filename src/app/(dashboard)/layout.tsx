import { Sidebar } from '@/components/layout/Sidebar'
import { ReminderEngine } from '@/components/layout/ReminderEngine'
import { SidebarProvider } from '@/components/providers/SidebarProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-[#F8FAFB]">
        <Sidebar />
        <ReminderEngine />
        <main className="md:ml-60 min-h-screen flex flex-col">{children}</main>
      </div>
    </SidebarProvider>
  )
}
