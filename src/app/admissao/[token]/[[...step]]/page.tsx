import { CandidatePortal } from '@/components/admission/CandidatePortal'
export default async function Page(props:{params: Promise<{token:string;step?:string[]}>}) {
  const params = await props.params;
  return <CandidatePortal token={params.token} step={params.step?.[0]}/>
}
