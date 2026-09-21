import { CandidatePortal } from '@/components/admission/CandidatePortal'
export default function Page({params}:{params:{token:string;step?:string[]}}){return <CandidatePortal token={params.token} step={params.step?.[0]||'inicio'}/>}
