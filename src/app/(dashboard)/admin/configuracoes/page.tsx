'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/components/providers/SettingsProvider'
import {
  Upload, X, CheckCircle2, Building2, Loader2, ImageIcon, Trash2, QrCode, Wifi,
} from 'lucide-react'

export default function ConfiguracoesPage() {
  const { settings, reload } = useSettings()

  const [logoFile, setLogoDragFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isRemovingLogo, setIsRemovingLogo] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setCompanyName(settings.companyName || '')
  }, [settings.companyName])

  function handleLogoSelect(file: File) {
    if (file.size > 2 * 1024 * 1024) { alert('Arquivo muito grande. Limite: 2 MB.'); return }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext ?? '')) {
      alert('Formato inválido. Use PNG, JPG, WEBP ou SVG.')
      return
    }
    setLogoDragFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadLogo() {
    if (!logoFile) return
    setIsUploadingLogo(true)
    const fd = new FormData()
    fd.append('logo', logoFile)
    const res = await fetch('/api/upload/logo', { method: 'POST', body: fd })
    setIsUploadingLogo(false)
    if (res.ok) {
      setLogoDragFile(null)
      setLogoPreview(null)
      reload()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const d = await res.json()
      alert(d.error ?? 'Erro ao fazer upload do logo.')
    }
  }

  async function removeLogo() {
    if (!confirm('Remover o logo atual? O sistema voltará ao padrão.')) return
    setIsRemovingLogo(true)
    await fetch('/api/upload/logo', { method: 'DELETE' })
    setIsRemovingLogo(false)
    setLogoDragFile(null)
    setLogoPreview(null)
    reload()
  }

  async function saveCompanyName() {
    if (!companyName.trim()) return
    setIsSavingName(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: companyName.trim() }),
    })
    setIsSavingName(false)
    reload()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const currentLogo = logoPreview || settings.logoUrl || null

  return (
    <>
      <Header title="Configurações do Sistema" subtitle="Identidade visual e personalização da plataforma" />
      <div className="p-6 space-y-6 max-w-2xl">

        {/* Feedback de salvo */}
        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Configurações salvas com sucesso!
          </div>
        )}

        {/* Nome da empresa */}
        <Card>
          <CardHeader>
            <CardTitle>Nome da Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Exibido na sidebar, tela de login e cabeçalho dos relatórios quando nenhum logo é configurado.
            </p>
            <div className="flex gap-3">
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: BHCL"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && saveCompanyName()}
              />
              <Button isLoading={isSavingName} onClick={saveCompanyName} disabled={!companyName.trim()}>
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Logo da Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-gray-500">
              Aparece na sidebar, tela de login e nos relatórios PDF. Recomendamos PNG ou SVG com fundo transparente. Máximo: 2 MB.
            </p>

            {/* Preview atual */}
            {currentLogo && (
              <div className="flex items-start gap-4">
                <div className="text-xs text-gray-500 font-medium w-20 pt-2 flex-shrink-0">Preview</div>
                <div className="flex items-center gap-6 flex-wrap">
                  {/* Sidebar preview */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-52 h-16 bg-white border border-gray-100 rounded-xl flex items-center px-4 shadow-sm">
                      <img src={currentLogo} alt="Preview sidebar" className="max-h-10 max-w-[140px] object-contain" />
                    </div>
                    <span className="text-xs text-gray-400">Sidebar</span>
                  </div>
                  {/* Login preview */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-52 h-16 rounded-xl flex items-center px-4"
                      style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
                      <img src={currentLogo} alt="Preview login" className="max-h-10 max-w-[140px] object-contain brightness-0 invert" />
                    </div>
                    <span className="text-xs text-gray-400">Tela de Login</span>
                  </div>
                  {/* PDF preview */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-52 h-16 bg-gray-50 border border-gray-100 rounded-xl flex items-center gap-3 px-4">
                      <img src={currentLogo} alt="Preview PDF" className="max-h-8 max-w-[60px] object-contain" />
                      <div>
                        <div className="h-2 w-20 bg-[#15AFA4] rounded mb-1" />
                        <div className="h-1.5 w-14 bg-gray-200 rounded" />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">Relatório PDF</span>
                  </div>
                </div>
              </div>
            )}

            {/* Zona de upload */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files[0]
                if (file) handleLogoSelect(file)
              }}
              className={`border-2 border-dashed rounded-xl transition-all ${
                isDragging
                  ? 'border-[#15AFA4] bg-[#15AFA4]/5'
                  : logoFile
                  ? 'border-[#15AFA4]/40 bg-[#15AFA4]/5'
                  : 'border-gray-200 bg-gray-50 hover:border-[#15AFA4]/40'
              }`}
            >
              {logoFile ? (
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="w-10 h-10 rounded-xl bg-[#15AFA4]/10 flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-5 h-5 text-[#15AFA4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{logoFile.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(logoFile.size / 1024).toFixed(0)} KB · Pronto para enviar
                    </p>
                  </div>
                  <button onClick={() => { setLogoDragFile(null); setLogoPreview(null) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-3 px-5 py-8 cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Clique para selecionar ou arraste o logo</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP, SVG · Máximo 2 MB</p>
                    <p className="text-xs text-gray-400">Recomendado: fundo transparente, proporção horizontal</p>
                  </div>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoSelect(f) }}
                  />
                </label>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center gap-3">
              {logoFile && (
                <Button icon={isUploadingLogo ? undefined : <Upload className="w-4 h-4" />} isLoading={isUploadingLogo} onClick={uploadLogo}>
                  Salvar Logo
                </Button>
              )}
              {settings.logoUrl && !logoFile && (
                <Button
                  variant="danger"
                  icon={isRemovingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  onClick={removeLogo}
                  disabled={isRemovingLogo}
                >
                  Remover Logo Atual
                </Button>
              )}
              {!settings.logoUrl && !logoFile && (
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Nenhum logo configurado — usando identidade padrão
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <EvolutionSettings />
      </div>
    </>
  )
}

type EvolutionState = { baseUrl:string;instance:string;hasApiKey:boolean;enabled:boolean;connected:boolean;state:string;error?:string;qrCode?:string;pairingCode?:string|null }

function EvolutionSettings() {
  const [data,setData]=useState<EvolutionState>({baseUrl:'',instance:'',hasApiKey:false,enabled:true,connected:false,state:'not_configured'})
  const [apiKey,setApiKey]=useState('')
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [qrLoading,setQrLoading]=useState(false)
  const [message,setMessage]=useState('')
  async function load(){setLoading(true);try{const response=await fetch('/api/admin/evolution',{cache:'no-store'});const result=await response.json();if(response.ok)setData(result);else setMessage(result.error)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  async function save(){setSaving(true);setMessage('');const response=await fetch('/api/admin/evolution',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseUrl:data.baseUrl,instance:data.instance,apiKey,enabled:data.enabled})});const result=await response.json();setSaving(false);if(!response.ok){setMessage(result.error||'Não foi possível salvar.');return}setApiKey('');setMessage('Configuração da Evolution API salva.');await load()}
  async function qr(){setQrLoading(true);setMessage('');const response=await fetch('/api/admin/evolution?qr=1',{cache:'no-store'});const result=await response.json();setQrLoading(false);if(!response.ok){setMessage(result.error||'Não foi possível gerar o QR Code.');return}setData(current=>({...current,...result}))}
  return <Card>
    <CardHeader><CardTitle>WhatsApp — Evolution API</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-gray-500">Configure a instância e leia o QR Code sem sair do painel. A chave fica criptografada e nunca é exibida novamente.</p>
      {loading?<div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin"/>Carregando conexão…</div>:<>
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${data.connected?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}><Wifi className="w-4 h-4"/>{data.connected?'WhatsApp conectado':data.state==='not_configured'?'Evolution API ainda não configurada':`Status: ${data.state}`}</div>
        <label className="block text-sm font-medium text-gray-700">URL da Evolution API<Input className="mt-1" value={data.baseUrl} placeholder="https://evolution.suaempresa.com" onChange={event=>setData(current=>({...current,baseUrl:event.target.value}))}/></label>
        <label className="block text-sm font-medium text-gray-700">Nome da instância<Input className="mt-1" value={data.instance} placeholder="people360" onChange={event=>setData(current=>({...current,instance:event.target.value}))}/></label>
        <label className="block text-sm font-medium text-gray-700">Chave da API<Input className="mt-1" type="password" value={apiKey} placeholder={data.hasApiKey?'Chave já cadastrada — deixe vazio para manter':'Informe a apikey'} onChange={event=>setApiKey(event.target.value)}/></label>
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={data.enabled} onChange={event=>setData(current=>({...current,enabled:event.target.checked}))}/>Ativar notificações por WhatsApp</label>
        {message&&<div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700" role="status">{message}</div>}
        <div className="flex gap-3"><Button isLoading={saving} onClick={save} disabled={!data.baseUrl||!data.instance||(!apiKey&&!data.hasApiKey)}>Salvar integração</Button><Button variant="secondary" icon={<QrCode className="w-4 h-4"/>} isLoading={qrLoading} onClick={qr} disabled={!data.hasApiKey}>Gerar / atualizar QR Code</Button></div>
        {data.qrCode&&<div className="flex flex-col items-center rounded-xl border border-gray-200 p-5"><img src={data.qrCode} alt="QR Code para conectar o WhatsApp" className="h-64 w-64"/><p className="mt-3 text-center text-sm text-gray-600">No WhatsApp, abra <strong>Aparelhos conectados</strong> e escaneie este código.</p>{data.pairingCode&&<p className="mt-2 font-mono text-lg font-semibold">{data.pairingCode}</p>}</div>}
      </>}
    </CardContent>
  </Card>
}
