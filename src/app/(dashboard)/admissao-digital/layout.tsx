import { AdmissionTourProvider } from '@/components/admission/help/AdmissionTourProvider'

export default function AdmissionDigitalLayout({ children }: { children: React.ReactNode }) {
  return <AdmissionTourProvider>{children}</AdmissionTourProvider>
}
