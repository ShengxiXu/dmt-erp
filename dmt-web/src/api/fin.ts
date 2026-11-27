import { http } from './request'
import type { PageResult } from './types'

export interface BankFlow {
  id: number
  flowNo: string
  arrivedAt: string
  payer: string
  amount: number
  method?: string
  referenceNo?: string
  status: string
  claimedAmt: number
  note?: string
}
export interface Bill {
  id: number
  billNo: string
  customerId: number
  contractId?: number
  period?: string
  amount: number
  receivedAmt: number
  status: string
  issueStatus?: string
  issuedAt?: string
  reviewNote?: string
  createdAt?: string
  dueDate?: string
  customerName?: string
  contractCode?: string
}

export function flowPage(params: Record<string, unknown>) {
  return http.get<PageResult<BankFlow>>('/finance/bank-flows', params)
}
export function createFlow(data: Partial<BankFlow>) {
  return http.post<number>('/finance/bank-flows', data)
}
export function flowMatch(id: number) {
  return http.get<{ flow: BankFlow; suggestions: { billId: number; billNo: string; period?: string; amount: number; balance: number; dueDate?: string }[]; remain: number }>(
    `/finance/bank-flows/${id}/match`,
  )
}
export function claimFlow(id: number, allocs: { billId: number; amount: number }[]) {
  return http.post<void>(`/finance/bank-flows/${id}/claim`, allocs)
}
export function redFlushFlow(id: number) {
  return http.post<void>(`/finance/bank-flows/${id}/red-flush`)
}
export function billPage(params: Record<string, unknown>) {
  return http.get<PageResult<{ bill: Bill; customerName?: string; contractCode?: string; linesSummary?: string }>>('/finance/bills', params)
}
export function reviewBill(id: number, pass: boolean, note?: string) {
  const q = new URLSearchParams({ pass: String(pass) })
  if (note) q.set('note', note)
  return http.post<void>(`/finance/bills/${id}/review?${q.toString()}`)
}
export function createBill(data: Partial<Bill>) {
  return http.post<number>('/finance/bills', data)
}
export function overdueBills() {
  return http.get<Bill[]>('/finance/bills/overdue')
}
export function runBillingScan(period: string) {
  return http.post<{ generated: number; skipped: number; details: string[] }>(`/finance/billing/scan?period=${period}`)
}
export interface OverdueBill {
  billId: number
  billNo: string
  customer: string
  contractId?: number
  period?: string
  amount: number
  balance: number
  dueDate: string
  overdueDays: number
  suspended?: boolean
  level: string
}
export interface SuspendTicket {
  id: number
  ticketNo: string
  type: string
  billId?: number
  billNo?: string
  customer?: string
  contractId?: number
  debtSummary?: string
  reason?: string
  status: string
  action?: string
  result?: string
  note?: string
  executedAt?: string
  createdAt?: string
}
export function ticketList(params?: Record<string, unknown>) {
  return http.get<SuspendTicket[]>('/finance/tickets', params)
}
export function createSuspend(billId: number, reason?: string) {
  return http.post<number>(`/finance/bills/${billId}/suspend`, reason ? { reason } : {})
}
export function executeTicket(id: number, data: { action: string; result: string; note?: string }) {
  return http.post<void>(`/finance/tickets/${id}/execute`, data)
}
export interface BadDebt {
  id: number
  bdNo: string
  billId: number
  billNo?: string
  customer?: string
  amount: number
  reason: string
  handling: string
  status: string
  rejectNote?: string
  createdAt?: string
}
export function overdueBillList() {
  return http.get<OverdueBill[]>('/finance/overdue-bills')
}
export function badDebtList(params?: Record<string, unknown>) {
  return http.get<BadDebt[]>('/finance/bad-debts', params)
}
export function submitBadDebt(data: { billId: number; reason: string; handling: string }) {
  return http.post<number>('/finance/bad-debts', data)
}
export function runSettle(period: string) {
  return http.post<{ batchNo: string; period: string; snapshotJson: string }>(`/finance/settle/run?period=${period}`)
}
export function settleBatches() {
  return http.get<PageResult<{ id: number; batchNo: string; period: string; snapshotJson: string }>>('/finance/settle/batches', { pageNum: 1, pageSize: 20 })
}
export interface InvoiceApp {
  id: number
  appNo: string
  entityId?: number
  customerId: number
  amount: number
  title?: string
  taxNo?: string
  status: string
  customerName?: string
  entityName?: string
}
export interface PayRequest {
  id: number
  reqNo: string
  payee: string
  amount: number
  reason?: string
  status: string
}
export function invoicePage(params: Record<string, unknown>) {
  return http.get<PageResult<InvoiceApp>>('/finance/invoices', params)
}
export function createInvoice(data: Record<string, unknown>) {
  return http.post<number>('/finance/invoices', data)
}
export function invoiceAction(id: number, action: string) {
  return http.post<void>(`/finance/invoices/${id}/action?action=${action}`)
}
export function payReqPage(params: Record<string, unknown>) {
  return http.get<PageResult<PayRequest>>('/finance/pay-requests', params)
}
export function createPayReq(data: Record<string, unknown>) {
  return http.post<number>('/finance/pay-requests', data)
}
export function payReqAction(id: number, action: string) {
  return http.post<void>(`/finance/pay-requests/${id}/action?action=${action}`)
}
