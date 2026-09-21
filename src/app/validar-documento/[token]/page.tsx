'use client'

import { useEffect, useState, use } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react'
import styles from '@/components/admission/Admission.module.css'

type Validation = {
  name: string; version: number; status: string; protocol: string; signer: string
  unit: string; validationCode: string; hash: string
}

export default function Page(props: { params: Promise<{ token: string }> }) {
  const params = use(props.params);
  const [data, setData] = useState<Validation>()
  const [error, setError] = useState('')
  useEffect(() => {
    fetch(`/api/validar-documento/${params.token}`).then(async (response) => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setData(body)
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Falha ao consultar o registro.'))
  }, [params.token])

  return <div className={styles.portal}><main className={styles.portalMain} style={{ paddingTop: 60 }}><section className={styles.portalCard} style={{ textAlign: 'center' }}>
    {error ? <><XCircle size={48} color="#C0392B"/><h1 className={styles.portalTitle}>Registro não encontrado</h1><p className={styles.portalText}>{error}</p></>
      : data ? <><CheckCircle2 size={48} color="#1E8E5A"/><h1 className={styles.portalTitle}>Registro localizado</h1><p className={styles.portalText}>O código corresponde a um documento emitido e registrado pelo People360 / BHCL. Compare o hash abaixo com o arquivo recebido.</p><div className={styles.summaryGrid} style={{ textAlign: 'left' }}>{Object.entries({ Documento: data.name, Versão: data.version, Status: data.status, Protocolo: data.protocol, Signatário: data.signer, Unidade: data.unit, Código: data.validationCode }).map(([key, value]) => <div key={key}><div className={styles.summaryLabel}>{key}</div><div className={styles.summaryValue}>{String(value)}</div></div>)}</div><div className={`${styles.input} ${styles.mono}`} style={{ height: 'auto', padding: 10, wordBreak: 'break-all', marginTop: 18 }}>{data.hash}</div></>
        : <div className={styles.skeleton}/>}
  </section></main></div>
}
