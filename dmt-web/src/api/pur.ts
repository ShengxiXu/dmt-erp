import { http } from './request'
import type { PageResult } from './types'

export interface PurReq {
  id: number
  reqNo: string
  source: string
  matKey?: string
  spec: string
  qty?: number
  unit?: string
  room?: string
  expectDate?: string
  note?: string
  status: string
  linkedWoId?: number
  poId?: number
}
export interface PurOrder {
  id: number
  poNo: string
  supplier: string
  taxRate?: number
  paymentTerms?: string
  status: string
  rejectReason?: string
  contractId?: number
  contractCode?: string
  lines?: { id: number; poId: number; lineType: string; spec: string; unitPrice: number; quantity: number; receivedQty: number; acceptedQty: number }[]
}

export interface SupBill {
  id: number
  billNo: string
  supplier: string
  period: string
  costItemId?: number
  amount: number
  poNo?: string
  contractNo?: string
  resRef?: string
  status: string
  tag?: string
  payDueDate?: string
  note?: string
  createdAt?: string
  refCount?: number
}
export function supBillList(params?: Record<string, unknown>) {
  return http.get<SupBill[]>('/purchase/bills', params)
}
export function createSupBill(data: Partial<SupBill>) {
  return http.post<number>('/purchase/bills', data)
}
export function postSupBill(id: number, tag?: string) {
  return http.post<void>(`/purchase/bills/${id}/post`, tag ? { tag } : {})
}
export function voidSupBill(id: number) {
  return http.post<void>(`/purchase/bills/${id}/void`)
}
export interface PurContract {
  id: number
  code: string
  buyerId?: number
  name: string
  supplier: string
  subject?: string
  billing?: string
  capacityM?: number
  monthlyCost?: number
  bwM?: number
  linePrice?: number
  unitPrice?: number
  effectAt?: string
  endAt?: string
  status?: string
  remark?: string
}
export interface PurOrderLine {
  id: number
  poId: number
  lineType: string
  spec: string
  unitPrice: number
  quantity: number
  receivedQty: number
  acceptedQty: number
}
export function purReqPage(params: Record<string, unknown>) {
  return http.get<PageResult<PurReq>>('/purchase/reqs', params)
}
export function createPurReq(data: Partial<PurReq>) {
  return http.post<number>('/purchase/reqs', data)
}
export function closePurReq(id: number) {
  return http.post<void>(`/purchase/reqs/${id}/close`)
}
export function convertPurReq(id: number, kind: string, poId?: number) {
  return http.post<{ kind: string; note?: string }>(`/purchase/reqs/${id}/convert?kind=${kind}${poId ? `&poId=${poId}` : ''}`)
}
export function purContractList(kw?: string) {
  return http.get<PurContract[]>('/purchase/contracts', kw ? { kw } : undefined)
}
export function savePurContract(data: Partial<PurContract>) {
  return http.post<number>('/purchase/contracts', data)
}
export function purOrderPage(params: Record<string, unknown>) {
  return http.get<PageResult<{ order: PurOrder; contractCode?: string; lines: PurOrderLine[] }>>('/purchase/orders', params)
}
export function createPurOrder(order: Record<string, unknown>, lines: Record<string, unknown>[]) {
  return http.post<number>('/purchase/orders', { order, lines })
}
export function submitPurOrder(id: number) {
  return http.post<void>(`/purchase/orders/${id}/submit`)
}
export function purReceipt(id: number, items: { lineId: number; arrived: number; result: string }[]) {
  return http.post<void>(`/purchase/orders/${id}/receipts`, { itemsJson: JSON.stringify(items) })
}
export function purInbound(id: number, devices: Record<string, unknown>[], segments?: Record<string, unknown>[]) {
  return http.post<void>(`/purchase/orders/${id}/inbound`, { devices, segments })
}
