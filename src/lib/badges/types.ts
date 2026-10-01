export type BadgeIssueType = 'INITIAL' | 'SECOND_COPY'

export type BadgeSnapshot = {
  employeeId: string
  fullName: string
  firstName: string
  lastName: string
  role: string
  department: string
  admissionDate: string
  document: string
  photoId: string
  photoFocusY: number
}

export type BadgeOverrides = Partial<Pick<BadgeSnapshot,
  'firstName' | 'lastName' | 'fullName' | 'role' | 'department' | 'admissionDate' | 'document' | 'employeeId' | 'photoFocusY'
>>

export type BadgeDocumentData = {
  issueType: BadgeIssueType
  reason?: string | null
  overrides: BadgeOverrides
}

export const BADGE_TYPE = 'CRACHA'
export const BADGE_CATEGORY = 'IDENTIFICACAO'
export const BADGE_TEMPLATE_KEY = 'BHCL_CR80'
export const BADGE_TEMPLATE_VERSION = 1
