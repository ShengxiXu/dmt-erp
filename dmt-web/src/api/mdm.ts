import { http } from './request'
import type { Customer, Contract, Opportunity, PageResult } from './types'

export function customerPage(params: Record<string, unknown>) {
  return http.get<PageResult<Customer>>('/customers', params)
}

export function createCustomer(data: Partial<Customer>) {
  return http.post<number>('/customers', data)
}

export function updateCustomer(id: number, data: Partial<Customer>) {
  return http.put<void>(`/customers/${id}`, data)
}

export function opportunityPage(params: Record<string, unknown>) {
  return http.get<PageResult<Opportunity>>('/opportunities', params)
}

export function createOpportunity(data: {
  customerId: number
  name: string
  source?: string
  remark?: string
  products?: { cat: string; ptype: string }[]
  expectAmount?: number
  expectMonths?: number
  expectedCloseAt?: string
}) {
  return http.post<number>('/opportunities', data)
}

export function updateOpportunity(id: number, data: Record<string, unknown>) {
  return http.put<void>(`/opportunities/${id}`, data)
}

export function changeOpportunityStage(id: number, stage: string) {
  return http.post<void>(`/opportunities/${id}/stage`, { stage })
}

export function contractPage(params: Record<string, unknown>) {
  return http.get<PageResult<Contract>>('/contracts', params)
}

export function contractDetail(id: number) {
  return http.get<Contract>(`/contracts/${id}`)
}

export function contractStep(id: number) {
  return http.post<void>(`/contracts/${id}/step`)
}

export function contractEffect(id: number) {
  return http.post<void>(`/contracts/${id}/effect`)
}

export function contractTerminate(id: number) {
  return http.post<void>(`/contracts/${id}/terminate`)
}

export function submitContractApproval(id: number) {
  return http.post<void>(`/contracts/${id}/submit`)
}

export function contractUpdate(id: number, data: Record<string, unknown>) {
  return http.put<void>(`/contracts/${id}`, data)
}

// ---------- 特批申请 ----------
export interface Special {
  id: number
  code: string
  opportunityId: number
  customerId: number
  customerName?: string
  opportunityName?: string
  discount: number
  expectAmount?: number
  reason?: string
  status: string
  createdAt?: string
}

export function specialPage(params: Record<string, unknown>) {
  return http.get<PageResult<Special>>('/specials', params)
}

export function createSpecial(data: { opportunityId: number; customerId: number; discount: number; expectAmount?: number; reason?: string }) {
  return http.post<number>('/specials', data)
}

// ---------- 签约主体 ----------
export interface EntitySeal { id?: number; name: string; type: string; sealNo?: string }
export interface Entity {
  id: number
  shortName: string
  fullName: string
  nature: string
  taxNo?: string
  bank?: string
  account?: string
  status: string
  seals: EntitySeal[]
}

export function entityList() {
  return http.get<Entity[]>('/entities')
}

export function createEntity(data: Partial<Entity>) {
  return http.post<number>('/entities', data)
}

export function updateEntity(id: number, data: Partial<Entity>) {
  return http.put<void>(`/entities/${id}`, data)
}

export function deleteEntity(id: number) {
  return http.delete<void>(`/entities/${id}`)
}

// ---------- 合同创建 ----------
export interface ContractLineReq { cat: string; ptype?: string; spec?: string; specs?: Record<string, string>; price?: number; specsJson?: string }
export function createContract(data: {
  customerId: number
  opportunityId: number
  specialId?: number | null
  entityId: number
  discount?: number
  payCycle?: string
  seal?: string
  terms?: string
  startDate?: string
  endDate?: string
  amount?: number
  lines: ContractLineReq[]
}) {
  return http.post<number>('/contracts', data)
}

