'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import styles from './Admission.module.css'
import { AdmissionTitle, formatDateTime, StatusBadge } from './shared'

type Template={id:string;key:string;name:string;version:number;active:boolean;updatedAt:string}
type DocumentType={id:string;name:string;required:boolean;maxSizeBytes:number;active:boolean}
type AdmissionSettings={
  providers:Record<string,string>
  faceVerification:{enabled:boolean;configured:boolean;autoApprove:boolean;autoReject:boolean;approveThreshold:number;reviewThreshold:number;detectionThreshold:number;referenceDocumentKeys:string[]}
  retentionDays:number
  maxFileSize:number
  transportDeclarationVersion:string
}

export function ModelsPage(){
  const [templates,setTemplates]=useState<Template[]>([])
  const [types,setTypes]=useState<DocumentType[]>([])
  const [open,setOpen]=useState(false)
  const [form,setForm]=useState({key:'',name:'',content:''})
  const [message,setMessage]=useState('')
  const load=useCallback(()=>Promise.all([fetch('/api/admissao-digital/modelos').then(r=>r.json()),fetch('/api/admissao-digital/meta').then(r=>r.json())]).then(([models,meta])=>{setTemplates(Array.isArray(models)?models:[]);setTypes(meta.documentTypes||[])}).catch(()=>setMessage('Não foi possível carregar os modelos.')),[])
  useEffect(()=>{load()},[load])
  async function submit(event:FormEvent){event.preventDefault();setMessage('')
    const response=await fetch('/api/admissao-digital/modelos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const result=await response.json().catch(()=>({error:'Não foi possível criar o modelo.'}))
    if(!response.ok){setMessage(result.error);return}
    setOpen(false);setForm({key:'',name:'',content:''});setMessage('Nova versão do modelo criada.');load()
  }
  const latest=templates.filter((template,index,list)=>list.findIndex(item=>item.key===template.key)===index)
  return <><Header title="Modelos de documentos" subtitle="Admissão Digital"/><div className={styles.module}><div className={styles.content}><AdmissionTitle title="Modelos de documentos" subtitle="Templates versionados e checklists configuráveis por empresa, unidade, cargo e contrato."><button className={styles.buttonPrimary} onClick={()=>setOpen(true)}>Novo modelo</button></AdmissionTitle>{message&&<div className={styles.docRow} role="status">{message}</div>}<div className={styles.grid2}><section className={styles.card}><h2 className={styles.cardTitle}>Templates admissionais</h2>{latest.length?latest.map(template=><div className={styles.attention} key={template.id}><div style={{flex:1}}><div className={styles.itemTitle}>{template.name}</div><div className={`${styles.itemMeta} ${styles.mono}`}>{template.key} · versão {template.version}</div></div><StatusBadge status={template.active?'APPROVED':'CANCELLED'} label={template.active?'Ativo':'Inativo'}/></div>):<div className={styles.empty}>Nenhum template cadastrado.</div>}</section><section className={styles.card}><h2 className={styles.cardTitle}>Checklist documental</h2>{types.map(type=><div className={styles.attention} key={type.id}><div style={{flex:1}}><div className={styles.itemTitle}>{type.name}</div><div className={styles.itemMeta}>{type.required?'Obrigatório':'Opcional'} · até {Math.round(type.maxSizeBytes/1048576)} MB</div></div><StatusBadge status={type.active?'APPROVED':'CANCELLED'} label={type.active?'Ativo':'Inativo'}/></div>)}</section></div></div></div>{open&&<div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="new-template-title"><form className={styles.modal} onSubmit={submit}><div className={styles.modalHeader}><h2 id="new-template-title" className={styles.cardTitle}>Novo modelo versionado</h2><button type="button" className={styles.iconButton} onClick={()=>setOpen(false)} aria-label="Fechar">×</button></div><div className={styles.modalBody}><div className={styles.formGrid}><label className={styles.field}><span className={styles.label}>Nome</span><input className={styles.input} required minLength={3} value={form.name} onChange={e=>setForm(value=>({...value,name:e.target.value}))}/></label><label className={styles.field}><span className={styles.label}>Chave técnica</span><input className={`${styles.input} ${styles.mono}`} required pattern="[a-z0-9_-]+" value={form.key} onChange={e=>setForm(value=>({...value,key:e.target.value.toLowerCase().replace(/\s+/g,'-')}))}/></label><label className={`${styles.field} ${styles.fieldWide}`}><span className={styles.label}>Conteúdo do documento</span><textarea className={styles.textarea} required minLength={20} rows={12} value={form.content} onChange={e=>setForm(value=>({...value,content:e.target.value}))}/><span className={styles.hint}>Use variáveis como {'{{candidate.name}}'} e {'{{admission.hireDate}}'}. O conteúdo integral permanece no banco, nunca no código.</span></label></div></div><div className={styles.modalFooter}><button type="button" className={styles.button} onClick={()=>setOpen(false)}>Cancelar</button><button className={styles.buttonPrimary}>Criar versão</button></div></form></div>}</>
}

export function SettingsPage(){
  const [data,setData]=useState<AdmissionSettings>()
  useEffect(()=>{fetch('/api/admissao-digital/configuracoes').then(response=>response.json()).then(setData)},[])
  const facial=data?.faceVerification
  const percentage=(value?:number)=>value==null?'—':`${Math.round(value*100)}%`
  return <><Header title="Configurações" subtitle="Admissão Digital"/><div className={styles.module}><div className={styles.content}>
    <AdmissionTitle title="Configurações" subtitle="Providers, retenção, documentos e textos jurídicos do módulo."/>
    {!facial?.enabled?<section className={styles.card} style={{marginBottom:16}}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Validação facial</h2><p className={styles.itemMeta}>A comparação biométrica não faz parte do fluxo atual de admissão ou atualização cadastral.</p></div><StatusBadge status="CANCELLED" label="Desativada"/></div></section>:<section className={styles.card} data-admission-tour="settings-face-policy" style={{marginBottom:16}}>
      <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Revisão facial por pontuação</h2><p className={styles.itemMeta}>Política aplicada pelo servidor após a comparação da selfie com o documento aprovado.</p></div><StatusBadge status={facial?.configured?'APPROVED':'ERROR'} label={facial?.configured?'CompreFace configurado':'Provider não configurado'}/></div>
      <div className={styles.faceScoreBands} data-admission-tour="settings-face-bands">
        <div data-tone="error"><strong>0% a {percentage(facial?.reviewThreshold)}</strong><span>{facial?.autoReject?'Nova captura automática':'Revisão manual'}<small>Baixa similaridade</small></span></div>
        <div data-tone="warn"><strong>{percentage(facial?.reviewThreshold)} a {percentage(facial?.approveThreshold)}</strong><span>Revisão humana<small>Resultado inconclusivo</small></span></div>
        <div data-tone="ok"><strong>{percentage(facial?.approveThreshold)} a 100%</strong><span>{facial?.autoApprove?'Aprovação automática':'Revisão manual (piloto)'}<small>Alta similaridade</small></span></div>
      </div>
      <div className={styles.docRow} data-admission-tour="settings-face-safety" style={{marginTop:16,marginBottom:0}}><strong>Proteção contra decisão indevida</strong><p className={styles.itemMeta}>Rosto não detectado, erro do provider, arquivo inválido ou imagem acima do limite nunca são aprovados automaticamente. A comparação facial não é prova de vida; resultados inconclusivos permanecem com o RH.</p></div>
      <div className={styles.summaryGrid} style={{marginTop:16}}><Summary label="Detecção mínima" value={percentage(facial?.detectionThreshold)}/><Summary label="Aprovação automática" value={facial?.autoApprove?'Ativa':'Desativada'}/><Summary label="Nova captura automática" value={facial?.autoReject?'Ativa':'Desativada'}/><Summary label="Documento de referência" value={facial?.referenceDocumentKeys?.join(', ')||'—'}/></div>
    </section>}
    <div className={styles.grid2}><section className={styles.card}><h2 className={styles.cardTitle}>Providers</h2>{data?.providers&&Object.entries(data.providers).map(([key,value])=><div className={styles.attention} key={key}><div style={{flex:1}}><div className={styles.itemTitle}>{key}</div><div className={`${styles.itemMeta} ${styles.mono}`}>{String(value)}</div></div><StatusBadge status={value==='disabled'?'CANCELLED':'APPROVED'} label={value==='disabled'?'Desativado':value==='mock'?'Mock local':'Configurado'}/></div>)}</section><section className={styles.card}><h2 className={styles.cardTitle}>Segurança e retenção</h2><div className={styles.summaryGrid} style={{marginTop:16}}><Summary label="Retenção" value={`${data?.retentionDays||'—'} dias`}/><Summary label="Arquivo máximo" value={`${Math.round((data?.maxFileSize||0)/1048576)} MB`}/><Summary label="Declaração VT" value={data?.transportDeclarationVersion||'—'}/><Summary label="Armazenamento" value="Privado"/></div><p className={styles.itemMeta} style={{marginTop:18}}>Textos jurídicos e prazos devem ser validados pelo Jurídico/DPO antes do uso em produção.</p></section></div>
  </div></div></>
}

export function AuditPage(){const [data,setData]=useState<any>({items:[]});useEffect(()=>{fetch('/api/admissao-digital/auditoria').then(response=>response.json()).then(setData)},[]);return <><Header title="Logs e auditoria" subtitle="Admissão Digital"/><div className={styles.module}><div className={styles.content}><AdmissionTitle title="Logs e auditoria" subtitle="Eventos imutáveis do processo, sem exposição de tokens ou dados sensíveis."/><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Data e hora</th><th>Ação</th><th>Ator</th><th>Admissão</th><th>Origem</th></tr></thead><tbody>{data.items?.map((item:any)=><tr key={item.id}><td>{formatDateTime(item.createdAt)}</td><td><span className={styles.mono}>{item.action}</span></td><td>{item.actorName||item.actorType}</td><td>{item.admission.protocol} · {item.admission.candidateName}</td><td>{item.actorType}</td></tr>)}</tbody></table></div></div></div></>}

function Summary({label,value}:{label:string;value:string}){return <div><div className={styles.summaryLabel}>{label}</div><div className={styles.summaryValue}>{value}</div></div>}
