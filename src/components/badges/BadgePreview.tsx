'use client'

import type { CSSProperties } from 'react'

export type BadgePreviewData = {
  fullName: string; firstName: string; lastName: string; role: string; department: string
  admissionDate: string; document: string; employeeId: string; photoFocusY: number; photoUrl?: string | null
}
function sizeFor(text: string, max: number, min: number, threshold: number) {
  if (text.length <= threshold) return max
  return Math.max(min, max - (text.length - threshold) * 0.14)
}

function BhclLogo() {
  return <svg viewBox="217 9 165 85" className="absolute" style={{ left: '56.3%', top: '2.33%', width: '38.3%', height: '12.33%' }} aria-label="BHCL">
    <g fill="#fff" style={{ fontFamily: 'Arial, sans-serif' }}>
      <polygon points="225.4,26.5 250.6,9 250.6,26 233,26 233,48 250.6,48 250.6,65.5 270,65.5 226,93.6 226,57 217,57 217,37 226,30.5" />
      <polygon points="273,47.5 286,47.5 273,57.5" />
      <text x="241" y="43" fontSize="15.4" fontWeight="700" textLength="40" lengthAdjust="spacingAndGlyphs">BHCL</text>
      <text x="300" y="34" fontSize="12.3" fontWeight="700" textLength="81" lengthAdjust="spacingAndGlyphs">BENEFICÊNCIA</text>
      <text x="300" y="48" fontSize="12.3" fontWeight="700" textLength="72.5" lengthAdjust="spacingAndGlyphs">HOSPITALAR</text>
      <text x="300" y="61.5" fontSize="12.3" fontWeight="500" textLength="47.5" lengthAdjust="spacingAndGlyphs">CESÁRIO</text>
      <text x="300" y="75" fontSize="12.3" fontWeight="500" textLength="37" lengthAdjust="spacingAndGlyphs">LANGE</text>
    </g>
  </svg>
}

const face: CSSProperties = { width: 216, height: 344, position: 'relative', overflow: 'hidden', flex: 'none', fontFamily: 'Arial, sans-serif', boxShadow: '0 8px 28px rgba(5,64,94,.18)' }

export function BadgeFront({ data }: { data: BadgePreviewData }) {
  return <div style={{ ...face, background: '#14678F' }} aria-label="Frente do crachá">
    <svg viewBox="0 0 54 86" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <rect width="54" height="86" fill="#14678F" />
      <g transform="rotate(30)"><rect x="-150" y="14.12" width="400" height="220" fill="#05405E" /><path d="M-150 -4.76 L37 -4.76 A2 2 0 0 1 39 -2.76 L39 31.77 A2 2 0 0 1 37 33.77 L-150 33.77 Z" fill="#0CAFD2" /><rect x="-150" y="54.13" width="400" height="12.55" fill="#fff" /><rect x="-150" y="66.68" width="400" height="200" fill="#0CAFD2" /><path d="M-150 69.28 L46 69.28 A1.5 1.5 0 0 1 47.5 70.78 L47.5 260 L-150 260 Z" fill="#14678F" /></g>
      <path d="M26.2 12.362 A1.6 1.6 0 0 1 27.8 12.362 L43.1 21.195 A1.6 1.6 0 0 1 43.9 22.581 L43.9 40.039 A1.6 1.6 0 0 1 43.1 41.425 L27.8 50.258 A1.6 1.6 0 0 1 26.2 50.258 L10.9 41.425 A1.6 1.6 0 0 1 10.1 40.039 L10.1 22.581 A1.6 1.6 0 0 1 10.9 21.195 Z" fill="#05405E" />
      <path d="M26.5 13.459 A1 1 0 0 1 27.5 13.459 L42.3 22.004 A1 1 0 0 1 42.8 22.87 L42.8 39.75 A1 1 0 0 1 42.3 40.616 L27.5 49.161 A1 1 0 0 1 26.5 49.161 L11.7 40.616 A1 1 0 0 1 11.2 39.75 L11.2 22.87 A1 1 0 0 1 11.7 22.004 Z" fill="#fff" />
    </svg>
    <BhclLogo />
    {data.photoUrl ? <img src={data.photoUrl} alt="" className="absolute object-cover" style={{ left: '21.67%', top: '15.99%', width: '56.67%', height: '40.84%', objectPosition: `50% ${data.photoFocusY}%`, clipPath: 'polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)' }} /> : null}
    <div className="absolute text-white font-bold text-center whitespace-nowrap overflow-hidden flex items-center justify-center" style={{ left: '4.63%', top: '61.45%', width: '90.74%', height: '8.14%', fontSize: sizeFor(data.firstName, 21.2, 12.8, 11) }}>{data.firstName}</div>
    <div className="absolute text-white italic text-center whitespace-nowrap overflow-hidden flex items-center justify-center" style={{ left: '4.63%', top: '70.35%', width: '90.74%', height: '7.56%', fontSize: sizeFor(data.lastName, 19.2, 10.4, 13) }}>{data.lastName}</div>
    <div className="absolute flex items-center justify-center" style={{ left: '4.63%', top: '77.9%', width: '90.74%', height: '16.86%' }}>
      <div className="bg-[#0CAFD2] text-white text-center rounded-[4px] px-[6px] py-[6px] max-w-full leading-[1.15] overflow-hidden" style={{ fontSize: sizeFor(data.role, 15.4, 9.6, 22), display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{data.role}</div>
    </div>
  </div>
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="min-h-[20px] flex items-center justify-center text-center whitespace-nowrap overflow-hidden px-1" style={{ fontSize: sizeFor(`${label}: ${value}`, 12, 7.2, 31) }}><b>{label}:</b>&nbsp;<span>{value}</span></div>
}

export function BadgeBack({ data }: { data: BadgePreviewData }) {
  return <div style={{ ...face, background: '#fff' }} aria-label="Verso do crachá">
    <svg viewBox="0 0 54 86" className="absolute inset-0 w-full h-full" aria-hidden="true"><rect width="54" height="86" fill="#fff" /><g transform="rotate(30)"><rect x="-150" y="-200" width="400" height="198.18" fill="#14678F" /><path d="M-150 -1.82 L28.4 -1.82 L28.4 4.24 A2 2 0 0 1 26.4 6.24 L-150 6.24 Z" fill="#0CAFD2" /><rect x="-150" y="67.55" width="400" height="200" fill="#0CAFD2" /><path d="M-150 69.1 L46.5 69.1 A1.5 1.5 0 0 1 48 70.6 L48 260 L-150 260 Z" fill="#14678F" /></g></svg>
    <BhclLogo />
    <div className="absolute flex flex-col gap-[9px]" style={{ left: '9.72%', top: '33.26%', width: '80.56%' }}>
      <div className="bg-[#0CAFD2] rounded-[5px] py-1 px-[7px] text-white"><InfoLine label="Nome" value={data.fullName} /><InfoLine label="Setor" value={data.department} /><InfoLine label="Admissão" value={data.admissionDate} /><InfoLine label="Documento" value={data.document} /></div>
      <div className="bg-[#0CAFD2] rounded-[5px] min-h-[35px] px-[7px] text-white flex items-center justify-center w-full"><InfoLine label="Matrícula" value={data.employeeId} /></div>
      <div className="px-[8px] text-[#1F3240] text-[7.6px] leading-[11.2px]"><div className="text-justify">Este crachá é de uso pessoal e</div><div className="text-justify">intransferível. É obrigatório o uso durante</div><div>a permanência na Unidade.</div></div>
    </div>
    <div className="absolute left-0 w-full flex items-center justify-center gap-[4px] text-[#05405E] text-[8.3px]" style={{ top: '93.6%', height: '3.2%' }}><span className="w-[10px] h-[10px] rounded-full bg-[#0CAFD2] text-white text-[7px] flex items-center justify-center">◎</span><span>www.bhcl.org.br</span></div>
  </div>
}

export function BadgePreview({ data }: { data: BadgePreviewData }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 justify-items-center">
    <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 text-center mb-2">Frente</p><BadgeFront data={data} /></div>
    <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 text-center mb-2">Verso</p><BadgeBack data={data} /></div>
  </div>
}
