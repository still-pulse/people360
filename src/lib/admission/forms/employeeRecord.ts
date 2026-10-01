import type { PDFDocument, PDFPage } from 'pdf-lib'
import { dmy, experiencePeriods, money, upper, type FormContext } from './context'
import { embedFonts, loadForm, replaceLine, type Fonts } from './pdfText'

export const EMPLOYEE_RECORD_FORM_FILE = 'ficha-empregado.pdf'

// A faixa branca cobre só o marcador "[•]" (com o destaque amarelo): mais alta que isso, apagava o rótulo impresso logo acima.
function field(page: PDFPage, value: string, x: number, pdfY: number, width: number, fonts: Fonts, size = 8.25, maskHeight = size + 2.2) {
  replaceLine(page, value, x, page.getHeight() - pdfY, width, { font: fonts.regular, size, height: maskHeight })
}

// Verso: sem rótulo acima do dado, a faixa sobe até o topo do destaque do marcador.
const backField = (page: PDFPage, value: string, x: number, pdfY: number, width: number, fonts: Fonts) => field(page, value, x, pdfY, width, fonts, 6.75, 9.8)

function scheduleParts(value: string) {
  const match = /(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/.exec(value)
  return match ? [match[1], match[2]] : [value, '']
}

export async function renderEmployeeRecord(ctx: FormContext): Promise<PDFDocument> {
  const pdf = await loadForm(EMPLOYEE_RECORD_FORM_FILE)
  const fonts = await embedFonts(pdf)
  const [front, back] = pdf.getPages()
  const { person, address, job } = ctx
  const periods = experiencePeriods(job.hireDate, job.experienceDays)
  const registration = person.registration
  const residence = [address.street, address.number, address.complement, address.district, address.city, address.state, address.zipCode].filter(Boolean).join(', ')
  const work = scheduleParts(job.schedule), rest = scheduleParts(job.breakSchedule)

  field(front, registration, 162.2, 795.7, 350, fonts)
  field(front, registration, 569.22, 795.7, 14, fonts)
  field(front, person.name, 20.27, 731.9, 271, fonts)
  field(front, ctx.dependents.map((dependent) => dependent.name).join(', '), 303.38, 731.9, 270, fonts)
  field(front, residence, 20.27, 705.63, 260, fonts)
  field(front, person.birthDate, 111.9, 674.1, 84, fonts)
  field(front, person.birthPlace, 207.27, 674.1, 195, fonts)
  field(front, person.nationality, 413.77, 674.1, 80, fonts)
  field(front, person.maritalStatus, 505.4, 674.1, 65, fonts)
  field(front, person.fatherName, 157.7, 658.33, 410, fonts)
  field(front, person.motherName, 157.7, 641.83, 410, fonts)
  field(front, person.rg, 111.9, 626.05, 86, fonts)
  field(front, person.rgIssuedAt, 207.27, 626.05, 52, fonts)
  field(front, person.rgIssuer, 268.85, 626.05, 58, fonts)
  field(front, person.voterTitle, 335.67, 626.05, 98, fonts)
  field(front, person.voterZone, 441.58, 626.05, 25, fonts)
  field(front, person.voterSection, 473.85, 626.05, 25, fonts)
  field(front, person.classRegistration, 505.4, 626.05, 66, fonts)
  field(front, person.ctps, 111.9, 608.8, 43, fonts)
  field(front, person.ctpsSeries, 161.45, 608.8, 45, fonts)
  field(front, person.ctpsIssuedAt, 214.02, 602.03, 72, fonts)
  field(front, person.ctpsState, 295.13, 608.8, 32, fonts)
  field(front, person.cpf, 335.67, 608.8, 87, fonts)
  field(front, person.driverLicense, 431.05, 608.8, 98, fonts)
  field(front, person.driverLicenseCategory, 536.92, 608.8, 35, fonts)
  field(front, person.militaryDocument, 111.9, 586.28, 68, fonts)
  field(front, person.militaryCategory, 187.75, 586.28, 58, fonts)
  field(front, person.ethnicity, 254.58, 586.28, 87, fonts)
  field(front, person.gender, 349.95, 586.28, 56, fonts)
  field(front, person.education, 413.77, 586.28, 156, fonts)
  field(front, person.disability ? `SIM - ${person.disabilityDetails}` : 'NÃO', 111.9, 569, 188, fonts)
  field(front, '', 308.65, 569, 126, fonts)
  field(front, person.phone, 443.83, 569, 126, fonts)
  field(front, upper(job.title), 111.9, 551.72, 208, fonts)
  field(front, upper(job.title), 328.92, 551.72, 185, fonts)
  field(front, job.cbo, 522.67, 551.72, 48, fonts)
  field(front, dmy(job.hireDate), 20.27, 531.47, 84, fonts)
  field(front, job.salary == null ? '' : money(job.salary), 126.92, 531.47, 75, fonts)
  field(front, 'MÊS', 211.02, 531.47, 54, fonts)
  field(front, work[0], 296.63, 531.47, 27, fonts)
  field(front, work[1], 334.93, 531.47, 94, fonts)
  field(front, rest[0], 457.33, 531.47, 27, fonts)
  field(front, rest[1], 495.63, 531.47, 75, fonts)
  field(front, dmy(job.hireDate), 67.58, 509.7, 82, fonts)
  field(front, person.pis, 88.63, 477.43, 96, fonts)
  field(front, person.name, 412.28, 97.58, 158, fonts)

  backField(back, person.name, 21.77, 797.2, 410, fonts)
  backField(back, registration, 454.33, 818.97, 116, fonts)
  backField(back, dmy(job.hireDate), 42.05, 757.42, 82, fonts)
  backField(back, dmy(periods.firstEnd), 135.93, 757.42, 82, fonts)
  backField(back, periods.extension ? String(periods.extension) : '', 248.58, 757.42, 52, fonts)
  backField(back, periods.totalEnd ? dmy(periods.totalEnd) : '', 322.9, 757.42, 82, fonts)
  backField(back, String(periods.first), 435.55, 757.42, 48, fonts)
  backField(back, 'SIM', 515.9, 757.42, 55, fonts)
  return pdf
}
