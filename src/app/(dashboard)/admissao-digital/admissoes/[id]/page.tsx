import { AdmissionDetail } from '@/components/admission/AdmissionDetail'
export default async function Page(props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return <AdmissionDetail id={params.id}/>
}
