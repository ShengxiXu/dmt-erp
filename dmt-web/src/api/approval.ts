import { http } from './request'
import type { PageResult } from './types'

export interface InstanceNode {
  seq: number
  name: string
  approverLabel: string
  result?: string
  comment?: string
  actedAt?: string
  actor?: string
  current: boolean
}

export interface Instance {
  id: number
  flowId: number
  docType: string
  docId: number
  status: string
  curSeq: number
  flowName: string
  docSummary: string
  submitter: string
  nodes: InstanceNode[]
}

export interface FlowDef {
  id: number
  name: string
  docType: string
  triggerAction: string
  conditionExpr?: string
  enabled: number
}

export interface FlowNode {
  id: number
  flowId: number
  seq: number
  name: string
  approverType: string
  approverRef?: string
}

export function todoPage(params: Record<string, unknown>) {
  return http.get<PageResult<Instance>>('/approvals/todo', params)
}

export function donePage(params: Record<string, unknown>) {
  return http.get<PageResult<Instance>>('/approvals/done', params)
}

export function instanceDetail(id: number) {
  return http.get<Instance>(`/approvals/instances/${id}`)
}

export function activeInstance(docType: string, docId: number) {
  return http.get<Instance | null>('/approvals/active', { docType, docId })
}

export function actInstance(id: number, approve: boolean, comment?: string) {
  return http.post<void>(`/approvals/instances/${id}/act`, { approve, comment })
}

export function resubmitInstance(id: number) {
  return http.post<number>(`/approvals/instances/${id}/resubmit`)
}

export function flowList() {
  return http.get<FlowDef[]>('/approval-flows')
}

export function flowNodes(id: number) {
  return http.get<FlowNode[]>(`/approval-flows/${id}/nodes`)
}

export function saveFlow(data: Partial<FlowDef> & { nodes?: Partial<FlowNode>[] }, id?: number) {
  return id ? http.put<void>(`/approval-flows/${id}`, data) : http.post<number>('/approval-flows', data)
}

export function toggleFlow(id: number, enabled: number) {
  return http.post<void>(`/approval-flows/${id}/enabled?enabled=${enabled}`)
}
