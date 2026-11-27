import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
    {
      path: '/',
      component: () => import('../layouts/MainLayout.vue'),
      redirect: '/workbench',
      children: [
        { path: 'workbench', component: () => import('../views/Workbench.vue') },
        // 概览
        { path: 'analytics', component: () => import('../views/analytics/AnalyticsPage.vue') },
        // 销售与合同
        { path: 'customer', component: () => import('../views/customer/CustomerList.vue') },
        { path: 'opportunity', component: () => import('../views/opportunity/OpportunityList.vue') },
        { path: 'special', component: () => import('../views/special/SpecialList.vue') },
        { path: 'contract', component: () => import('../views/contract/ContractList.vue') },
        { path: 'contract/edit', component: () => import('../views/contract/ContractEdit.vue') },
        { path: 'contract/detail', component: () => import('../views/contract/ContractDetail.vue') },
        // 产品与资源
        { path: 'product', component: () => import('../views/product/ProductList.vue') },
        { path: 'product/bom', component: () => import('../views/product/ProductBomPage.vue') },
        { path: 'product/specs', component: () => import('../views/product/ProductSpecsPage.vue') },
        { path: 'materials', component: () => import('../views/resource/MaterialsPage.vue') },
        { path: 'cost-items', component: () => import('../views/cost/CostItemList.vue') },
        { path: 'cost-centers', component: () => import('../views/cost/CostCenterList.vue') },
        { path: 'resources/r0', component: () => import('../views/resource/PoolList.vue') },
        { path: 'resources/r1', component: () => import('../views/resource/ExitList.vue') },
        { path: 'resources/r2', component: () => import('../views/resource/BaseLineList.vue') },
        { path: 'resources/r3', component: () => import('../views/resource/IpList.vue') },
        { path: 'resources/r4', component: () => import('../views/resource/EquipmentList.vue') },
        { path: 'resources/chain-map', component: () => import('../views/resource/ChainMapPage.vue') },
        // 采购与库存
        { path: 'purchase/reqs', component: () => import('../views/purchase/PurReqsPage.vue') },
        { path: 'purchase/orders', component: () => import('../views/purchase/PurOrdersPage.vue') },
        { path: 'purchase/orders/:id', component: () => import('../views/purchase/PurchaseOrderDetail.vue') },
        { path: 'purchase/contracts', component: () => import('../views/purchase/PurContractsPage.vue') },
        { path: 'bills', component: () => import('../views/purchase/SupBillsPage.vue') },
        { path: 'bills/:id', component: () => import('../views/purchase/SupBillDetail.vue') },
        // 交付与核算
        { path: 'approval', component: () => import('../views/approval/ApprovalCenter.vue') },
        { path: 'delivery', component: () => import('../views/wo/DeliveryList.vue') },
        { path: 'cost', component: () => import('../views/cost/CostLedger.vue') },
        // 财务
        { path: 'finance/claims', component: () => import('../views/finance/ClaimsPage.vue') },
        { path: 'billing', component: () => import('../views/finance/BillsPage.vue') },
        { path: 'finance/settle', component: () => import('../views/finance/SettlePage.vue') },
        { path: 'finance/overdue', component: () => import('../views/finance/OverduePage.vue') },
        { path: 'finance/invoices', component: () => import('../views/finance/InvoicesPage.vue') },
        { path: 'pay-requests', component: () => import('../views/finance/PayReqPage.vue') },
        { path: 'lifecycle', component: () => import('../views/lifecycle/LifecyclePage.vue') },
        // 系统管理
        { path: 'system/departments', component: () => import('../views/system/DepartmentsPage.vue') },
        { path: 'system/users', component: () => import('../views/system/UserList.vue') },
        { path: 'system/entities', component: () => import('../views/entity/EntityList.vue') },
        { path: 'system/settings', component: () => import('../views/system/SettingsPage.vue') },
        { path: 'system/approval', component: () => import('../views/approval/FlowConfig.vue') },
        { path: 'notifications', component: () => import('../views/system/NotificationsPage.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/workbench' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!auth.token && to.name !== 'login') {
    return { name: 'login' }
  }
  if (auth.token && to.name === 'login') {
    return { path: '/workbench' }
  }
  if (auth.token && !auth.profileData) {
    return auth.fetchProfile().then(() => true)
  }
  return true
})

export default router
