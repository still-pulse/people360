'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { SlidersHorizontal, ChevronLeft, ChevronRight, Trash2, XCircle } from 'lucide-react'
import styles from './Admission.module.css'
import { AdmissionTitle, ErrorState, formatDateTime, NewAdmissionButton, SearchBox, StatusBadge } from './shared'

type Row = { id:string; candidateName:string; cpfMasked:string; jobTitle:string; status:string; progress:number; lastActivityAt:string; hireDate:string; unit:{name:string}; owner?:{name:string}; documents:{status:string}[]; erpnextSyncs:{status:string}[] }
type Response = { items:Row[]; pagination:{page:number; pageSize:number; total:number; pages:number} }
type Meta = { units:{id:string;name:string}[]; users:{id:string;name:string}[] }

export function AdmissionList() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [data,setData] = useState<Response|null>(null)
  const [meta,setMeta] = useState<Meta>({ units:[], users:[] })
  const [search,setSearch] = useState('')
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState('')
  const [unitId,setUnitId] = useState('')
  const [ownerId,setOwnerId] = useState('')
  const [from,setFrom] = useState('')
  const [to,setTo] = useState('')
  const [sort,setSort] = useState('lastActivityAt')
  const [advanced,setAdvanced] = useState(false)
  const [selected,setSelected] = useState<string[]>([])
  const [page,setPage] = useState(1)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  useEffect(() => { const id=setTimeout(()=>{setQuery(search);setPage(1)},350); return()=>clearTimeout(id) }, [search])
  useEffect(() => { fetch('/api/admissao-digital/meta').then(r=>r.ok?r.json():Promise.reject()).then(setMeta).catch(()=>undefined) }, [])
  const load = useCallback(async()=>{
    setLoading(true); setError('')
    try {
      const p=new URLSearchParams({ page:String(page), pageSize:'20', sort })
      if(query)p.set('search',query); if(status)p.set('status',status); if(unitId)p.set('unitId',unitId); if(ownerId)p.set('ownerId',ownerId); if(from)p.set('from',from); if(to)p.set('to',to)
      const r=await fetch(`/api/admissao-digital/admissoes?${p}`)
      if(!r.ok)throw new Error()
      setData(await r.json())
    } catch { setError('Não foi possível carregar as admissões.') } finally { setLoading(false) }
  },[page,query,status,unitId,ownerId,from,to,sort])
  useEffect(()=>{load()},[load])
  useEffect(()=>{setSelected([])},[page,query,status,unitId,ownerId,from,to,sort])

  const clearFilters=()=>{setSearch('');setStatus('');setUnitId('');setOwnerId('');setFrom('');setTo('');setSort('lastActivityAt');setPage(1)}
  const toggleAll=()=>setSelected(current=>current.length===(data?.items.length||0)?[]:(data?.items.map(item=>item.id)||[]))
  async function cancelSelected(){
    if(!selected.length||!window.confirm(`Cancelar ${selected.length} admissão(ões) selecionada(s)? Esta ação será auditada.`))return
    setLoading(true)
    try {
      const responses=await Promise.all(selected.map(id=>fetch(`/api/admissao-digital/admissoes/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancel',reason:'Cancelamento em lote pelo RH'})})))
      if(responses.some(response=>!response.ok))throw new Error()
      setSelected([]); await load()
    } catch { setError('Não foi possível cancelar todos os processos selecionados.') } finally { setLoading(false) }
  }

  async function deleteSelected(){
    if(!selected.length||!window.confirm(`EXCLUIR DEFINITIVAMENTE ${selected.length} admissão(ões)?\n\nDados, documentos, fotos, assinaturas e PDFs serão apagados e não poderão ser recuperados. Admissões já integradas ao ERPNext não serão excluídas.`))return
    setLoading(true); setError('')
    try {
      const results=await Promise.all(selected.map(async id=>{const response=await fetch(`/api/admissao-digital/admissoes/${id}`,{method:'DELETE'});return response.ok?null:(await response.json().catch(()=>({}))).error||'Falha ao excluir.'}))
      const failures=results.filter((message):message is string=>!!message)
      setSelected([]); await load()
      if(failures.length)setError(`${failures.length} de ${results.length} não foram excluída(s): ${failures[0]}`)
    } catch { setError('Não foi possível excluir as admissões selecionadas.') } finally { setLoading(false) }
  }

  const filtered=!!(search||status||unitId||ownerId||from||to||sort!=='lastActivityAt')
  return <><Header title="Admissões" subtitle="Admissão Digital"/><div className={styles.module}><div className={styles.content}>
    <AdmissionTitle tourId="list-heading" title="Admissões" subtitle="Acompanhe cada processo, pendência, responsável e integração."><NewAdmissionButton/></AdmissionTitle>
    <div className={styles.filterBar} data-admission-tour="list-filters"><SearchBox value={search} onChange={setSearch}/><select className={styles.select} value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">Todos os status</option><option value="LINK_SENT">Aguardando candidato</option><option value="IN_PROGRESS">Em andamento</option><option value="DOCUMENTS_UNDER_REVIEW">Documentos em análise</option><option value="CORRECTION_REQUESTED">Correção solicitada</option><option value="SIGNATURE_PENDING">Aguardando assinatura</option><option value="ERPNEXT_ERROR">Erro no ERPNext</option><option value="COMPLETED">Concluída</option></select><button className={styles.button} aria-expanded={advanced} onClick={()=>setAdvanced(value=>!value)}><SlidersHorizontal size={14}/>Filtros avançados</button>{filtered&&<button className={styles.button} onClick={clearFilters}>Limpar filtros</button>}</div>
    {advanced&&<div className={styles.card} style={{marginBottom:16}}><div className={styles.formGrid}><label className={styles.field}><span className={styles.label}>Unidade</span><select className={styles.select} value={unitId} onChange={e=>{setUnitId(e.target.value);setPage(1)}}><option value="">Todas</option>{meta.units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className={styles.field}><span className={styles.label}>Responsável</span><select className={styles.select} value={ownerId} onChange={e=>{setOwnerId(e.target.value);setPage(1)}}><option value="">Todos</option>{meta.users.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className={styles.field}><span className={styles.label}>Criada a partir de</span><input className={styles.input} type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1)}}/></label><label className={styles.field}><span className={styles.label}>Criada até</span><input className={styles.input} type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(1)}}/></label><label className={styles.field}><span className={styles.label}>Ordenação</span><select className={styles.select} value={sort} onChange={e=>{setSort(e.target.value);setPage(1)}}><option value="lastActivityAt">Última atividade</option><option value="candidateName">Candidato</option><option value="hireDate">Data de admissão</option><option value="createdAt">Data de criação</option><option value="status">Status</option></select></label></div></div>}
    {!!selected.length&&<div className={styles.docRow} style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>{selected.length} selecionada(s)</strong><div className={styles.actions}><button className={styles.buttonDanger} onClick={cancelSelected}><XCircle size={14}/>Cancelar em lote</button>{isAdmin&&<button className={styles.buttonDanger} onClick={deleteSelected}><Trash2 size={14}/>Excluir</button>}</div></div>}
    {error?<ErrorState message={error} retry={load}/>:<div className={styles.tableWrap} data-admission-tour="list-table"><table className={styles.table}><thead><tr><th><input type="checkbox" aria-label="Selecionar todas" checked={!!data?.items.length&&selected.length===data.items.length} onChange={toggleAll}/></th><th>Candidato</th><th>Cargo</th><th>Unidade</th><th>Etapa</th><th>Status</th><th>Pendências</th><th>Última atividade</th><th>ERPNext</th><th>Ações</th></tr></thead><tbody>
      {loading?Array.from({length:8},(_,i)=><tr key={i}><td colSpan={10}><div className={styles.skeleton}/></td></tr>):data?.items.length?data.items.map(row=>{const pending=row.documents.filter(d=>['PENDING','REJECTED','RESUBMISSION_REQUIRED'].includes(d.status)).length;return <tr key={row.id}><td><input type="checkbox" aria-label={`Selecionar ${row.candidateName}`} checked={selected.includes(row.id)} onChange={()=>setSelected(value=>value.includes(row.id)?value.filter(id=>id!==row.id):[...value,row.id])}/></td><td><Link className={styles.tableLink} href={`/admissao-digital/admissoes/${row.id}`}>{row.candidateName}</Link><div className={`${styles.itemMeta} ${styles.mono}`}>{row.cpfMasked}</div></td><td>{row.jobTitle}</td><td>{row.unit.name}</td><td>{row.progress}% concluído</td><td><StatusBadge status={row.status}/></td><td>{pending?<StatusBadge status="CORRECTION_REQUESTED" label={`${pending} pendência${pending>1?'s':''}`}/>:<span className={styles.itemMeta}>Sem pendências</span>}</td><td>{formatDateTime(row.lastActivityAt)}</td><td><StatusBadge status={row.erpnextSyncs[0]?.status||'WAITING'} label={row.erpnextSyncs[0]?.status==='SUCCESS'?'Sincronizado':row.erpnextSyncs[0]?.status==='ERROR'?'Erro':'Aguardando'}/></td><td><Link className={styles.button} href={`/admissao-digital/admissoes/${row.id}`}>Abrir</Link></td></tr>}):<tr><td colSpan={10}><div className={styles.empty}><strong>Nenhuma admissão encontrada</strong><p>Ajuste os filtros ou crie uma nova admissão.</p></div></td></tr>}
    </tbody></table></div>}
    {data&&<div className={styles.pagination} data-admission-tour="list-pagination"><span>{data.pagination.total} resultado{data.pagination.total===1?'':'s'} · página {data.pagination.page} de {Math.max(1,data.pagination.pages)}</span><div className={styles.actions}><button className={styles.button} disabled={page<=1} onClick={()=>setPage(value=>value-1)}><ChevronLeft size={14}/>Anterior</button><button className={styles.button} disabled={page>=data.pagination.pages} onClick={()=>setPage(value=>value+1)}>Próxima<ChevronRight size={14}/></button></div></div>}
  </div></div></>
}
