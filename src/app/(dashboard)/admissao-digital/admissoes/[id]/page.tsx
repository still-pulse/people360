import { AdmissionDetail } from '@/components/admission/AdmissionDetail'
export default function Page({params}:{params:{id:string}}){return <AdmissionDetail id={params.id}/>}
