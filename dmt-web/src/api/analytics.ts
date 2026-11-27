import { http } from './request'

export interface AnalyticsOverview {
  monthlyRevenue: number
  activeContractCount: number
  monthlyExitCost: number
  exitLineCount: number
  grossMargin: number
  marginRate: number
  receivableTotal: number
  receivedTotal: number
  receiveRate: number
  overdueTotal: number
  overdueRate: number
  outstandingCount: number
  revenueTrend: { month: string; amount: number; received: number }[]
  aging: { bucket: string; amount: number }[]
  aging5: { bucket: string; amount: number; count: number }[]
  dso: number
  badCandidate: number
  pipeline: { stage: string; count: number; amount: number }[]
  pipelineFollowingSum: number
  wonUnsigned: number
  expiring: { contractId: number; code: string; customer: string; endDate: string; daysLeft: number; monthlyFee: number }[]
  exitWater: { label: string; soldM: string; capM: number; pct: number; pool: boolean }[]
  batches: { batchNo: string; period: string }[]
}
export function analyticsOverview() {
  return http.get<AnalyticsOverview>('/analytics/overview')
}
