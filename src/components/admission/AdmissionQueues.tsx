'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { RotateCw, ZoomIn, Check, X, Search } from 'lucide-react'
import styles from './Admission.module.css'
import { AdmissionTitle, ErrorState, formatDateTime, StatusBadge } from './shared'
import type { AdmissionProcessType } from '@/lib/admission/constants'

type PendingItem = { id:string; candidateName:string; jobTitle:string; status:string; reason:string; stoppedSince:string; priority:string; recommendedAction:string; unit:{name:string}; owner?:{name:string} }
type ReviewItem = { id:string; kind?:'document'|'badge'; storagePath?:string; mimeType?:string; type:{name:string}; admission:{id:string;candidateName:string;jobTitle:string;unit:{name:string}} }
type ReviewGroup = { admission:ReviewItem['admission']; docs:ReviewItem[] }
const normalizeSearch=(value:string)=>value.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()

export function PendingQueue({ processType = 'ADMISSION' }: { processType?: AdmissionProcessType }){
  const isUpdate=processType==='REGISTRATION_UPDATE'
  const [items,setItems]=useState<PendingItem[]>([])
  const [view,setView]=useState('lista')
  const [error,setError]=useState('')
  const load=useCallback(()=>fetch(`/api/admissao-digital/pendencias?processType=${processType}`).then(response=>{if(!response.ok)throw Error();return response.json()}).then(setItems).catch(()=>setError('Não foi possível carregar as pendências.')),[processType])
  useEffect(()=>{load()},[load])
  const groups=useMemo(()=>items.reduce<Record<string,PendingItem[]>>((result,item)=>{const key=view==='unidade'?item.unit.name:view==='responsável'?(item.owner?.name||'Não atribuído'):item.status;(result[key]??=[]).push(item);return result},{}),[items,view])
  return <><Header title="Pendências" subtitle={isUpdate?'Atualização Cadastral':'Admissão Digital'}/><div className={styles.module}><div className={styles.content}>
    <AdmissionTitle tourId="pending-heading" actionsTourId="pending-views" title={isUpdate?'Pendências de atualização cadastral':'Pendências de admissão'} subtitle="Priorize processos parados e execute a ação recomendada."><div className={styles.tabs} style={{margin:0}}>{['lista','kanban','unidade','responsável'].map(value=><button key={value} className={`${styles.tab} ${view===value?styles.tabActive:''}`} onClick={()=>setView(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div></AdmissionTitle>
    <div data-admission-tour="pending-content">{error?<ErrorState message={error} retry={load}/>:view==='lista'?<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{isUpdate?'Colaborador':'Candidato'}</th><th>Cargo</th><th>Unidade</th><th>Motivo</th><th>Tempo parado</th><th>Prioridade</th><th>Responsável</th><th>Ação</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><Link className={styles.tableLink} href={`/admissao-digital/admissoes/${item.id}`}>{item.candidateName}</Link></td><td>{item.jobTitle}</td><td>{item.unit.name}</td><td>{item.reason}</td><td>{formatDateTime(item.stoppedSince)}</td><td><StatusBadge status={item.priority==='URGENT'?'ERROR':'CORRECTION_REQUESTED'} label={item.priority}/></td><td>{item.owner?.name||'Não atribuído'}</td><td><Link className={styles.button} href={`/admissao-digital/admissoes/${item.id}`}>{item.recommendedAction}</Link></td></tr>)}</tbody></table></div>:<div className={styles.grid3}>{Object.entries(groups).map(([group,cards])=><section className={styles.card} key={group}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>{group}</h2><span className={styles.badge}>{cards.length}</span></div>{cards.map(item=><Link className={styles.docRow} style={{display:'block'}} href={`/admissao-digital/admissoes/${item.id}`} key={item.id}><strong>{item.candidateName}</strong><div className={styles.itemMeta}>{item.reason} · {item.unit.name}</div></Link>)}</section>)}</div>}</div>
  </div></div></>
}

export function ReviewQueue({ processType = 'ADMISSION' }: { processType?: AdmissionProcessType }){
  const isUpdate=processType==='REGISTRATION_UPDATE'
  const person=isUpdate?'colaborador':'candidato'
  const [items,setItems]=useState<ReviewItem[]>([])
  const [selected,setSelected]=useState<ReviewItem|null>(null)
  const [reason,setReason]=useState('')
  const [error,setError]=useState('')
  const [zoom,setZoom]=useState(1)
  const [rotation,setRotation]=useState(0)
  const [candidateId,setCandidateId]=useState('')
  const [search,setSearch]=useState('')
  const load=useCallback(()=>fetch(`/api/admissao-digital/revisao?processType=${processType}`).then(response=>{if(!response.ok)throw Error();return response.json()}).then((data:ReviewItem[])=>{setItems(data);setSelected(current=>{const same=current&&data.find(item=>item.id===current.id);if(same)return same;const next=current&&data.find(item=>item.admission.id===current.admission.id);return next||data[0]||null})}).catch(()=>setError('Não foi possível carregar a fila.')),[processType])
  const groups=useMemo(()=>{const map=new Map<string,ReviewGroup>();for(const item of items){const group=map.get(item.admission.id);if(group)group.docs.push(item);else map.set(item.admission.id,{admission:item.admission,docs:[item]})}return [...map.values()]},[items])
  const visibleGroups=useMemo(()=>{const term=normalizeSearch(search.trim());return term?groups.filter(group=>normalizeSearch(`${group.admission.candidateName} ${group.admission.jobTitle} ${group.admission.unit.name}`).includes(term)):groups},[groups,search])
  useEffect(()=>{setCandidateId(current=>selected?selected.admission.id:groups.some(group=>group.admission.id===current)?current:'')},[selected,groups])
  function chooseCandidate(id:string){const group=groups.find(item=>item.admission.id===id);setCandidateId(id);setSelected(group?.docs[0]||null);setZoom(1);setRotation(0);setReason('')}
  useEffect(()=>{load()},[load])
  async function review(action:string){
    if(!selected)return
    if(action!=='approve'&&!reason.trim()){setError('Informe o motivo da reprovação ou reenvio.');return}
    const response=selected.kind==='badge'
      ?await fetch(`/api/admissao-digital/admissoes/${selected.admission.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action==='approve'?'approve-badge':'request-badge-retry',reason})})
      :await fetch(`/api/admissao-digital/documentos/${selected.id}/revisao`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,reason})})
    if(!response.ok){setError((await response.json()).error);return}
    setReason('');setError('');setZoom(1);setRotation(0);load()
  }
  const selectedUrl=selected?.kind==='badge'?selected?`/api/admissao-digital/admissoes/${selected.admission.id}/foto`:'':selected?`/api/admissao-digital/documentos/${selected.id}/arquivo`:''
  const selectedIsImage=selected?.kind==='badge'||selected?.mimeType?.startsWith('image/')
  return <><Header title="Revisão de documentos" subtitle={isUpdate?'Atualização Cadastral':'Admissão Digital'}/><div className={styles.module} style={{padding:0}}>{error&&<div className={styles.toast}>{error}</div>}<div className={styles.reviewWorkspace}>
    <aside data-admission-tour="review-queue" className={`${styles.cardFlush} ${styles.reviewQueuePane}`}><div className={styles.reviewQueueHeader}><div><h2 className={styles.cardTitle}>Fila de {person}s</h2><p className={styles.itemMeta}>{groups.length} {person}(s) · {items.length} documento(s) aguardando análise</p></div><div style={{position:'relative'}}><Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#8A9A98'}}/><input className={styles.input} style={{paddingLeft:30}} placeholder={`Buscar ${person}, cargo ou unidade`} value={search} onChange={event=>setSearch(event.target.value)}/></div><select className={styles.select} value={candidateId} onChange={event=>chooseCandidate(event.target.value)}><option value="">{visibleGroups.length?`Selecione um ${person}`:`Nenhum ${person} encontrado`}</option>{visibleGroups.map(group=><option key={group.admission.id} value={group.admission.id}>{group.admission.candidateName} ({group.docs.length})</option>)}</select></div>
      {visibleGroups.map(group=>{const open=group.admission.id===candidateId;return <div key={group.admission.id} style={{borderTop:'1px solid #EEF3F2'}}><button onClick={()=>chooseCandidate(group.admission.id)} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,width:'100%',textAlign:'left',border:0,background:open?'#F1F9F8':'#fff',padding:14,cursor:'pointer'}}><span><strong>{group.admission.candidateName}</strong><span className={styles.itemMeta} style={{display:'block'}}>{group.admission.jobTitle} · {group.admission.unit.name}</span></span><span className={styles.itemMeta} style={{whiteSpace:'nowrap',fontWeight:600}}>{group.docs.length} doc.</span></button>{open&&<div style={{background:'#F8FBFB',paddingBottom:6}}>{group.docs.map(item=><button key={item.id} onClick={()=>{setSelected(item);setZoom(1);setRotation(0)}} style={{display:'block',width:'100%',textAlign:'left',border:0,borderLeft:`3px solid ${selected?.id===item.id?'#0F9B8E':'transparent'}`,background:selected?.id===item.id?'#E6F4F2':'transparent',padding:'8px 14px 8px 22px',cursor:'pointer',fontSize:13}}>{item.type.name}</button>)}</div>}</div>})}
      {!!search&&!visibleGroups.length&&<p className={styles.itemMeta} style={{padding:16}}>Nenhum {person} corresponde à busca.</p>}</aside>
    <main data-admission-tour="review-viewer" className={styles.reviewViewer} style={{overflow:zoom>1?'auto':'hidden'}}>{selected?.storagePath?<div className={styles.reviewCanvas} style={{transform:`scale(${zoom}) rotate(${rotation}deg)`}}>{selectedIsImage?<img alt={selected.kind==='badge'?'Foto do crachá':`Documento ${selected.type.name}`} src={selectedUrl} style={{padding:selected.kind==='badge'?0:18}}/>:<iframe title="Visualização do documento" src={`${selectedUrl}#zoom=page-fit&view=FitH`}/>}</div>:<div className={styles.empty}>Selecione um documento enviado.</div>}<div className={`${styles.actions} ${styles.reviewToolbar}`}><button className={styles.button} onClick={()=>setZoom(value=>value>1?1:1.25)}><ZoomIn size={14}/>{zoom>1?'Reduzir':'Ampliar'}</button><button className={styles.button} onClick={()=>setRotation(value=>(value+90)%360)}><RotateCw size={14}/>Girar</button></div></main>
    <aside data-admission-tour="review-actions" className={`${styles.cardFlush} ${styles.reviewActionsPane}`}>{selected&&<><h2 className={styles.cardTitle}>{selected.type.name}</h2><p className={styles.itemMeta}>{selected.admission.candidateName}<br/>{selected.admission.jobTitle} · {selected.admission.unit.name}</p><hr style={{border:0,borderTop:'1px solid #EEF3F2',margin:'18px 0'}}/><label className={styles.label}>Motivo da reprovação ou reenvio</label><select className={styles.select} value={reason} onChange={event=>setReason(event.target.value)}><option value="">Selecione um motivo</option><option>Documento ilegível</option><option>Documento cortado</option><option>Documento vencido</option><option>Foto com reflexo</option><option>Informações divergentes</option><option>Frente ou verso ausente</option><option>Arquivo incorreto</option>{selected.kind==='badge'&&<><option>Rosto não aparece por inteiro</option><option>Fundo inadequado</option><option>Foto escura ou desfocada</option><option>Uso de acessórios (boné, óculos escuros)</option></>}</select><div className={styles.metricList} style={{marginTop:14}}><button className={styles.buttonPrimary} onClick={()=>review('approve')}><Check size={14}/>Aprovar e avançar</button><button className={styles.button} onClick={()=>review('resubmit')}><RotateCw size={14}/>{selected.kind==='badge'?'Solicitar nova foto':'Solicitar reenvio'}</button>{selected.kind==='badge'?<p className={styles.itemMeta}>Ao solicitar reenvio, o candidato recebe o motivo e tira uma nova foto.</p>:<button className={styles.buttonDanger} onClick={()=>review('reject')}><X size={14}/>Reprovar</button>}</div></>}</aside>
  </div></div></>
}
