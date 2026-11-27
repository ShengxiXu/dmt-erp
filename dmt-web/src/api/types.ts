export interface PageResult<T> {
  records: T[]
  total: number
  pageNum: number
  pageSize: number
}

export interface Profile {
  user: {
    id: number
    username: string
    name: string
    mobile?: string
    deptId?: number
    status: string
  }
  roles: string[]
  perms: string[]
}

export interface Customer {
  id: number
  name: string
  creditCode?: string
  level?: string
  industry?: string
  source?: string
  address?: string
  invoiceTitle?: string
  taxNo?: string
  salesId?: number
  salesName?: string
  contact?: string
  contactPhone?: string
  contactTitle?: string
  email?: string
  remark?: string
  status: string
}

export interface Contract {
  id: number
  code: string
  customerId: number
  customerName?: string
  opportunityId: number
  opportunityName?: string
  entityId: number
  entityName?: string
  specialId?: number
  discount: number
  payCycle?: string
  seal?: string
  terms?: string
  startDate?: string
  endDate?: string
  amount?: number
  status: string
  step: number
  lines?: ContractLine[]
  versions?: { v: number; note: string; at: string }[]
}

export interface ContractLine {
  id: number
  contractId: number
  cat: string
  ptype?: string
  spec?: string
  price?: number
  specsJson?: string
}

export interface Opportunity {
  id: number
  code: string
  customerId: number
  customerName?: string
  name: string
  stage: string
  source?: string
  remark?: string
  products?: { cat: string; ptype: string }[]
  expectAmount?: number
  expectMonths?: number
  expectedCloseAt?: string
  salesId?: number
  salesName?: string
}

export interface ProductType {
  id: number
  cat: string
  name: string
  status: string
  remark?: string
  specFields?: { key: string; label: string; type: 'select' | 'number' | 'text' | 'date' | 'switch'; options?: string[]; placeholder?: string; required?: boolean }[]
  plans?: { id: string; name: string; price?: number; values: Record<string, string>; remark?: string }[]
}

export interface ExitLine {
  id: number
  code: string
  name: string
  carrier?: string
  bandwidthM: number
  costMonth?: number
  ipSegment?: string
  status: string
}

export interface ExitPool {
  id: number
  code: string
  name: string
  product?: string
  capacityM: number
  usedM: number
  rentMonth?: number
  status: string
}

export interface CostItem {
  id: number
  itemKey: string
  name: string
  dept?: string
  costType: string
  unit?: string
  subject?: string
  calcKind?: string
  appliesTo?: string
  demoQty?: number
  status: string
}

export interface UserVo {
  id: number
  username: string
  name: string
  mobile?: string
  deptId?: number
  deptName?: string
  status: string
  roleIds: number[]
  roleNames: string[]
}
