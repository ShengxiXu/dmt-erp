import { http } from './request'
import type { PageResult } from './types'

export interface SheetLine {
  id: number
  sheetId: number
  contractLineId?: number
  itemKey: string
  dept: string
  qty?: number
  meta?: string
  amount?: number
  calcText?: string
  pickSpec?: string
  sourceNo?: string
}

export interface Sheet {
  id: number
  code: string
  contractId: number
  contractCode?: string
  customerId: number
  customerName?: string
  opportunityName?: string
  status: string
  opsDone: number
  techDone: number
  curNode?: string
  margin?: number
  monthlyCost?: number
  contractValue?: number
  changeVersion: number
  opsLines?: SheetLine[]
  techLines?: SheetLine[]
  contractLines?: { id: number; contractId: number; cat: string; ptype?: string; spec?: string; price?: number }[]
}

export interface Snapshot {
  id: number
  sheetId: number
  snapshotJson: string
  lockedAt: string
}

export function sheetPage(params: Record<string, unknown>) {
  return http.get<PageResult<Sheet>>('/sheets', params)
}

export function sheetDetail(id: number) {
  return http.get<Sheet>(`/sheets/${id}`)
}

export function saveSheetLines(id: number, dept: string, lines: Partial<SheetLine>[]) {
  return http.put<void>(`/sheets/${id}/lines`, { dept, lines })
}

export function submitSheet(id: number, dept: string) {
  return http.post<void>(`/sheets/${id}/submit?dept=${encodeURIComponent(dept)}`)
}

export function startApproval(id: number) {
  return http.post<void>(`/sheets/${id}/start-approval`)
}

export function sheetSnapshot(id: number) {
  return http.get<Snapshot>(`/sheets/${id}/snapshot`)
}
