import { http } from './request'

export interface Subscription {
  subNo: string
  contractId: number
  lineId: number
  customer: string
  contractNo: string
  product?: string
  spec?: string
  monthlyFee?: number
  startDate?: string
  endDate?: string
  status: string
}
export interface LcChange {
  id: number
  chNo: string
  contractId: number
  lineId: number
  customer?: string
  contractNo?: string
  type: string
  fromVal?: string
  toVal?: string
  monthlyFeeAfter?: number
  costDelta?: number
  costBasis?: string
  effective?: string
  reason?: string
  status: string
  rejectNote?: string
  createdAt?: string
}
export interface LcTerminate {
  id: number
  tmNo: string
  contractId: number
  lineId: number
  customer?: string
  contractNo?: string
  reason: string
  reasonText?: string
  effectivePeriod?: string
  penalty?: number
  penaltyBasis?: string
  status: string
  rejectNote?: string
  recoverStatus?: string
  recoverNote?: string
  followStatus?: string
  followNote?: string
  executedAt?: string
  createdAt?: string
}

export function subscriptionList() {
  return http.get<Subscription[]>('/lifecycle/subscriptions')
}
export function changeList(params?: Record<string, unknown>) {
  return http.get<LcChange[]>('/lifecycle/changes', params)
}
export function submitChange(data: Partial<LcChange>) {
  return http.post<number>('/lifecycle/changes', data)
}
export function terminateList(params?: Record<string, unknown>) {
  return http.get<LcTerminate[]>('/lifecycle/terminates', params)
}
export function penaltyRef(contractId: number, lineId: number, period: string) {
  return http.get<{ penalty: number; basis: string }>('/lifecycle/terminates/penalty-ref', { contractId, lineId, period })
}
export function submitTerminate(data: Partial<LcTerminate>) {
  return http.post<number>('/lifecycle/terminates', data)
}
export function executeRecover(id: number, note?: string) {
  return http.post<void>(`/lifecycle/terminates/${id}/recover`, { note })
}
export function confirmFollow(id: number, kind: 'has' | 'none', note?: string) {
  const q = new URLSearchParams({ kind })
  if (note) q.set('note', note)
  return http.post<void>(`/lifecycle/terminates/${id}/follow?${q.toString()}`)
}
