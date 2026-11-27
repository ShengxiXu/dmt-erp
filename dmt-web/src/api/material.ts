import { http } from './request'

export interface MaterialAttr {
  key: string
  label: string
  method: string
  options?: string[]
  source?: string
  placeholder?: string
  numeric?: boolean
  dynamic?: boolean
}
export interface Material {
  id: number
  matKey: string
  name: string
  form: string
  groupName?: string
  archiveKey?: string
  status: string
  remark?: string
  attrsJson?: string
  purchaseKind?: string
  purchaseUnit?: string
}
export function materialList() {
  return http.get<Material[]>('/materials')
}
export function createMaterial(data: Partial<Material>) {
  return http.post<number>('/materials', data)
}
export function updateMaterial(id: number, data: Partial<Material>) {
  return http.put<void>(`/materials/${id}`, data)
}
