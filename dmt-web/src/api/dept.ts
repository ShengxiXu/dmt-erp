import { http } from './request'

export interface Dept {
  id: number
  name: string
  parentId?: number
  createdAt?: string
}
export function deptList() {
  return http.get<Dept[]>('/depts')
}
export function createDept(data: { name: string; parentId?: number }) {
  return http.post<number>('/depts', data)
}
export function updateDept(id: number, data: { name: string; parentId?: number }) {
  return http.put<void>(`/depts/${id}`, data)
}
export function deleteDept(id: number) {
  return http.delete<void>(`/depts/${id}`)
}
