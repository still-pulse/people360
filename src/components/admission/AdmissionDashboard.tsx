'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Upload, ArrowRight, RefreshCw } from 'lucide-react'
import styles from './Admission.module.css'
import { AdmissionTitle, ErrorState, LoadingCards, NewAdmissionButton, statusLabel, StatusBadge, formatDateTime } from './shared'

type DashboardData = {
  total:number; indicators:Record<string,number>; stages:{status:string;count:number}[];
  units:{id:string;name:string;color:string;count:number}[];
  attention:{id:string;candidateName:string;jobTitle:string;status:string;lastActivityAt:string;unit:{name:string}}[];
  recent:{id:string;action:string;actorName?:string;actorType:string;createdAt:string;admission:{candidateName:string}}[];
}

const metrics = [
  ['total','Total de admissões','#0F9B8E'],['inProgress','Em andamento','#2563A8'],['awaitingCandidate','Aguardando candidato','#C77B0A'],['pendingDocuments','Documentos pendentes','#C77B0A'],
  ['documentsReview','Documentos em análise','#2563A8'],['awaitingSignature','Aguardando assinatura','#7A5AA8'],['completed','Concluídas','#1E8E5A'],['erpErrors','Erros no ERPNext','#C0392B'],
] as const

export function AdmissionDashboard() {
  const [data,setData]=useState<DashboardData|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [days,setDays]=useState('30')
  const load=useCallback(async()=>{ setLoading(true);setError(''); try{const r=await fetch(`/api/admissao-digital/dashboard?days=${days}`);if(!r.ok)throw new Error();setData(await r.json())}catch{setError('Não foi possível carregar os indicadores.')}finally{setLoading(false)}},[days])
  useEffect(()=>{load()},[load])
  const maxStage=useMemo(()=>Math.max(1,...(data?.stages.map(s=>s.count)||[1])),[data])
  return <><Header title="Admissão Digital" subtitle="Gestão segura do processo admissional"/><div className={styles.module}><div className={styles.content}>
    <AdmissionTitle title="Admissão Digital" subtitle="Acompanhe todas as admissões em andamento, revise documentos e integre os novos colaboradores ao ERPNext.">
      <select className={styles.select} style={{width:150}} value={days} onChange={e=>setDays(e.target.value)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Este trimestre</option><option value="365">Últimos 12 meses</option></select>
      <button className={styles.button} onClick={load}><RefreshCw size={14}/>Atualizar</button><Link className={styles.button} href="/candidatos"><Upload size={14}/>Importar candidatos</Link><NewAdmissionButton/>
    </AdmissionTitle>
    {loading?<LoadingCards count={8}/>:error?<ErrorState message={error} retry={load}/>:data&&<>
      <div className={styles.kpiGrid}>{metrics.map(([key,label,color])=><div className={styles.kpi} style={{'--accent':color} as React.CSSProperties} key={key}><div className={styles.kpiLabel}>{label}</div><div className={styles.kpiValue}>{data.indicators[key]??0}</div><div className={styles.kpiMeta}>Período selecionado</div></div>)}</div>
      <div className={styles.grid2}>
        <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Distribuição por etapa</h2><span className={styles.itemMeta}>{data.total} processos</span></div><div className={styles.metricList}>{data.stages.length?data.stages.map(s=><div className={styles.metricRow} key={s.status}><span>{statusLabel[s.status]||s.status}</span><div className={styles.barTrack}><div className={styles.bar} style={{width:`${Math.round(s.count/maxStage*100)}%`}}/></div><strong>{s.count}</strong></div>):<div className={styles.empty}>Nenhuma admissão no período.</div>}</div></section>
        <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Admissões por unidade</h2></div><div className={styles.metricList}>{data.units.map(u=><div className={styles.metricRow} key={u.id}><span>{u.name}</span><div className={styles.barTrack}><div className={styles.bar} style={{width:`${Math.max(4,Math.round(u.count/Math.max(1,data.total)*100))}%`,'--bar':u.color||'#0F9B8E'} as React.CSSProperties}/></div><strong>{u.count}</strong></div>)}</div></section>
      </div>
      <div className={styles.grid2}>
        <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Exige atenção</h2><Link href="/admissao-digital/pendencias" className={styles.tableLink}>Ver todas <ArrowRight size={12}/></Link></div>{data.attention.length?data.attention.map(a=><div className={styles.attention} key={a.id}><span className={styles.dot} style={{'--dot':a.status==='ERPNEXT_ERROR'?'#C0392B':'#C77B0A'} as React.CSSProperties}/><div style={{flex:1}}><div className={styles.itemTitle}>{a.candidateName}</div><div className={styles.itemMeta}>{statusLabel[a.status]} · {a.jobTitle} · {a.unit.name}</div></div><Link href={`/admissao-digital/admissoes/${a.id}`} className={styles.button}>Abrir</Link></div>):<div className={styles.empty}>Nenhuma pendência prioritária.</div>}</section>
        <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Atividades recentes</h2></div>{data.recent.length?data.recent.map(a=><div className={styles.attention} key={a.id}><span className={styles.dot} style={{'--dot':'#0F9B8E'} as React.CSSProperties}/><div><div className={styles.itemTitle}>{a.admission.candidateName}</div><div className={styles.itemMeta}>{a.action.replaceAll('_',' ').toLowerCase()} · {a.actorName||a.actorType}<br/>{formatDateTime(a.createdAt)}</div></div></div>):<div className={styles.empty}>As atividades aparecerão aqui.</div>}</section>
      </div>
    </>}
  </div></div></>
}
