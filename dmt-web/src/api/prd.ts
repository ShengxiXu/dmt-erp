import { http } from './request'
import type { CostItem, ExitLine, ExitPool, ProductType, UserVo } from './types'
import type { PageResult } from './types'

export function productTypeList() {
  return http.get<ProductType[]>('/product-types')
}
export interface TypeMaterial {
  typeId?: number
  materialKey: string
  qty?: number
  remark?: string
}
export function typeMaterials(id: number) {
  return http.get<TypeMaterial[]>(`/product-types/${id}/materials`)
}
export function saveTypeMaterials(id: number, data: { cat?: string; name?: string; status?: string; remark?: string; materials: TypeMaterial[] }) {
  return http.put<void>(`/product-types/${id}/materials`, data)
}

export function exitList(params?: Record<string, unknown>) {
  return http.get<ExitLine[]>('/archives/exits', params)
}

export function poolList(params?: Record<string, unknown>) {
  return http.get<ExitPool[]>('/archives/pools', params)
}

export interface BaseLine {
  id: number
  code: string
  name: string
  carrier?: string
  bwM?: number
  billing?: string
  price?: number
  contractNo?: string
  shareable?: string
  effect?: string
  status: string
}
export function baseLineList(params?: Record<string, unknown>) {
  return http.get<BaseLine[]>('/archives/base-lines', params)
}
export function createBaseLine(data: Partial<BaseLine>) {
  return http.post<number>('/archives/base-lines', data)
}
export function updateBaseLine(id: number, data: Partial<BaseLine>) {
  return http.put<void>(`/archives/base-lines/${id}`, data)
}
export interface IpSegment {
  id: number
  seg: string
  count: number
  exitId?: number
  status: string
}
export interface Equipment {
  id: number
  name: string
  category?: string
  costPrice?: number
  supplier?: string
  stock: number
  locked: number
}
export function ipSegmentList(params?: Record<string, unknown>) {
  return http.get<IpSegment[]>('/archives/ip-segments', params)
}
export function createIpSegment(data: Partial<IpSegment>) {
  return http.post<number>('/archives/ip-segments', data)
}
export function updateIpSegment(id: number, data: Partial<IpSegment>) {
  return http.put<void>(`/archives/ip-segments/${id}`, data)
}
export function equipmentList(params?: Record<string, unknown>) {
  return http.get<Equipment[]>('/archives/equipment', params)
}
export function createEquipment(data: Partial<Equipment>) {
  return http.post<number>('/archives/equipment', data)
}
export function updateEquipment(id: number, data: Partial<Equipment>) {
  return http.put<void>(`/archives/equipment/${id}`, data)
}

export function addLoadRecord(exitId: number, usedM: number) {
  return http.post<number>(`/archives/exits/${exitId}/load-records?usedM=${usedM}`)
}

export function costItemList(params?: Record<string, unknown>) {
  return http.get<CostItem[]>('/cost-items', params)
}

export function costCenterList() {
  return http.get<unknown[]>('/cost-centers')
}

export function priceDictList(dictKey?: string) {
  return http.get<unknown[]>('/price-dicts', dictKey ? { dictKey } : undefined)
}

export function userPage(params: Record<string, unknown>) {
  return http.get<PageResult<UserVo>>('/users', params)
}
