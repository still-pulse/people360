'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { RotateCw, ZoomIn, Check, X } from 'lucide-react'
import styles from './Admission.module.css'
import { AdmissionTitle, ErrorState, formatDateTime, StatusBadge } from './shared'

type PendingItem = { id:string; candidateName:string; jobTitle:string; status:string; reason:string; stoppedSince:string; priority:string; recommendedAction:string; unit:{name:string}; owner?:{name:string} }
type ReviewItem = { id:string; storagePath?:string; type:{name:string}; admission:{candidateName:string;jobTitle:string;unit:{name:string}} }

export function PendingQueue(){
  const [items,setItems]=useState<PendingItem[]>([])
  const [view,setView]=useState('lista')
  const [error,setError]=useState('')
  const load=useCallback(()=>fetch('/api/admissao-digital/pendencias').then(response=>{if(!response.ok)throw Error();return response.json()}).then(setItems).catch(()=>setError('Não foi possível carregar as pendências.')),[])
  useEffect(()=>{load()},[load])
  const groups=useMemo(()=>items.reduce<Record<string,PendingItem[]>>((result,item)=>{const key=view==='unidade'?item.unit.name:view==='responsável'?(item.owner?.name||'Não atribuído'):item.status;(result[key]??=[]).push(item);return result},{}),[items,view])
  return <><Header title="Pendências" subtitle="Admissão Digital"/><div className={styles.module}><div className={styles.content}>
    <AdmissionTitle tourId="pending-heading" actionsTourId="pending-views" title="Pendências de admissão" subtitle="Priorize processos parados e execute a ação recomendada."><div className={styles.tabs} style={{margin:0}}>{['lista','kanban','unidade','responsável'].map(value=><button key={value} className={`${styles.tab} ${view===value?styles.tabActive:''}`} onClick={()=>setView(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div></AdmissionTitle>
    <div data-admission-tour="pending-content">{error?<ErrorState message={error} retry={load}/>:view==='lista'?<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Candidato</th><th>Cargo</th><th>Unidade</th><th>Motivo</th><th>Tempo parado</th><th>Prioridade</th><th>Responsável</th><th>Ação</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><Link className={styles.tableLink} href={`/admissao-digital/admissoes/${item.id}`}>{item.candidateName}</Link></td><td>{item.jobTitle}</td><td>{item.unit.name}</td><td>{item.reason}</td><td>{formatDateTime(item.stoppedSince)}</td><td><StatusBadge status={item.priority==='URGENT'?'ERROR':'CORRECTION_REQUESTED'} label={item.priority}/></td><td>{item.owner?.name||'Não atribuído'}</td><td><Link className={styles.button} href={`/admissao-digital/admissoes/${item.id}`}>{item.recommendedAction}</Link></td></tr>)}</tbody></table></div>:<div className={styles.grid3}>{Object.entries(groups).map(([group,cards])=><section className={styles.card} key={group}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>{group}</h2><span className={styles.badge}>{cards.length}</span></div>{cards.map(item=><Link className={styles.docRow} style={{display:'block'}} href={`/admissao-digital/admissoes/${item.id}`} key={item.id}><strong>{item.candidateName}</strong><div className={styles.itemMeta}>{item.reason} · {item.unit.name}</div></Link>)}</section>)}</div>}</div>
  </div></div></>
}

export function ReviewQueue(){
  const [items,setItems]=useState<ReviewItem[]>([])
  const [selected,setSelected]=useState<ReviewItem|null>(null)
  const [reason,setReason]=useState('')
  const [error,setError]=useState('')
  const [zoom,setZoom]=useState(1)
  const [rotation,setRotation]=useState(0)
  const load=useCallback(()=>fetch('/api/admissao-digital/revisao').then(response=>{if(!response.ok)throw Error();return response.json()}).then((data:ReviewItem[])=>{setItems(data);setSelected(current=>current?data.find(item=>item.id===current.id)||data[0]:data[0])}).catch(()=>setError('Não foi possível carregar a fila.')),[])
  useEffect(()=>{load()},[load])
  async function review(action:string){
    if(!selected)return
    if(action!=='approve'&&!reason.trim()){setError('Informe o motivo da reprovação ou reenvio.');return}
    const response=await fetch(`/api/admissao-digital/documentos/${selected.id}/revisao`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,reason})})
    if(!response.ok){setError((await response.json()).error);return}
    setReason('');setError('');setZoom(1);setRotation(0);load()
  }
  return <><Header title="Revisão de documentos" subtitle="Admissão Digital"/><div className={styles.module} style={{padding:0}}>{error&&<div className={styles.toast}>{error}</div>}<div style={{display:'grid',gridTemplateColumns:'280px minmax(0,1fr) 320px',minHeight:'calc(100vh - 64px)'}}>
    <aside data-admission-tour="review-queue" className={styles.cardFlush} style={{borderRadius:0,borderTop:0,borderBottom:0}}><div style={{padding:16}}><h2 className={styles.cardTitle}>Fila de revisão</h2><p className={styles.itemMeta}>{items.length} documentos aguardando análise</p></div>{items.map(item=><button key={item.id} onClick={()=>{setSelected(item);setZoom(1);setRotation(0)}} style={{display:'block',width:'100%',textAlign:'left',border:0,borderTop:'1px solid #EEF3F2',background:selected?.id===item.id?'#F1F9F8':'#fff',padding:14,cursor:'pointer'}}><strong>{item.admission.candidateName}</strong><div className={styles.itemMeta}>{item.type.name} · {item.admission.unit.name}</div></button>)}</aside>
    <main data-admission-tour="review-viewer" style={{background:'#E9EFEE',display:'grid',placeItems:'center',padding:24,position:'relative',overflow:'auto'}}>{selected?.storagePath?<div style={{width:'100%',height:'100%',minHeight:500,background:'#fff',borderRadius:8,overflow:'hidden',transform:`scale(${zoom}) rotate(${rotation}deg)`,transformOrigin:'center',transition:'transform .2s ease'}}><iframe title="Visualização do documento" src={`/api/admissao-digital/documentos/${selected.id}/arquivo`} style={{width:'100%',height:'100%',border:0}}/></div>:<div className={styles.empty}>Selecione um documento enviado.</div>}<div className={styles.actions} style={{position:'absolute',top:16,zIndex:2}}><button className={styles.button} onClick={()=>setZoom(value=>value>=1.5?1:Number((value+.25).toFixed(2)))}><ZoomIn size={14}/>{zoom>1?'Reduzir':'Ampliar'}</button><button className={styles.button} onClick={()=>setRotation(value=>(value+90)%360)}><RotateCw size={14}/>Girar</button></div></main>
    <aside data-admission-tour="review-actions" className={styles.cardFlush} style={{borderRadius:0,borderTop:0,borderBottom:0,padding:18}}>{selected&&<><h2 className={styles.cardTitle}>{selected.type.name}</h2><p className={styles.itemMeta}>{selected.admission.candidateName}<br/>{selected.admission.jobTitle} · {selected.admission.unit.name}</p><hr style={{border:0,borderTop:'1px solid #EEF3F2',margin:'18px 0'}}/><label className={styles.label}>Motivo da reprovação ou reenvio</label><select className={styles.select} value={reason} onChange={event=>setReason(event.target.value)}><option value="">Selecione um motivo</option><option>Documento ilegível</option><option>Documento cortado</option><option>Documento vencido</option><option>Foto com reflexo</option><option>Informações divergentes</option><option>Frente ou verso ausente</option><option>Arquivo incorreto</option></select><div className={styles.metricList} style={{marginTop:14}}><button className={styles.buttonPrimary} onClick={()=>review('approve')}><Check size={14}/>Aprovar e avançar</button><button className={styles.button} onClick={()=>review('resubmit')}><RotateCw size={14}/>Solicitar reenvio</button><button className={styles.buttonDanger} onClick={()=>review('reject')}><X size={14}/>Reprovar</button></div></>}</aside>
  </div></div></>
}
