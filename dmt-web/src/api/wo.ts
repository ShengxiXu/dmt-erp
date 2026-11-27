import { http } from './request'
import type { PageResult } from './types'

export interface WoTask { id: number; woId: number; name: string; sort: number; done: number }
export interface Assignment {
  id: number
  woId: number
  kind: string
  refId?: number
  qty?: number
  status: string
  refName?: string
}
export interface DeductRecord {
  id: number
  assignmentId: number
  refId?: number
  beforeQty?: number
  afterQty?: number
  actedAt?: string
}
export interface WorkOrder {
  id: number
  code: string
  sheetId: number
  sheetCode?: string
  contractId: number
  contractCode?: string
  customerName?: string
  status: string
  deliverySnapshot?: string
  tasks: WoTask[]
  assignments: Assignment[]
  deductRecords: DeductRecord[]
}

export function woPage(params: Record<string, unknown>) {
  return http.get<PageResult<WorkOrder>>('/work-orders', params)
}

export function woDetail(id: number) {
  return http.get<WorkOrder>(`/work-orders/${id}`)
}

export function availabilityCheck(id: number, loadConclusion?: string) {
  return http.post<{ pass: boolean; problems: string[]; loadConclusion: string; note: string }>(
    `/work-orders/${id}/availability-check?loadConclusion=${encodeURIComponent(loadConclusion ?? '')}`,
  )
}

export function applyAssignments(id: number, items: { kind: string; refId: number; qty: number }[]) {
  return http.post<void>(`/work-orders/${id}/assignments`, { items })
}

export function bindAssignment(id: number) {
  return http.post<void>(`/assignments/${id}/bind`)
}

export function completeWo(id: number) {
  return http.post<void>(`/work-orders/${id}/complete`)
}

export function activateWo(id: number) {
  return http.post<void>(`/work-orders/${id}/activate`)
}
