import { Routes, Route, Navigate } from 'react-router'
import { ShellLayout } from './components/ArcoShell'
import Home from './pages/Home'
import Workbench from './pages/Workbench'
import Analytics from './pages/Analytics'
import Entities from './pages/Entities'
import Resources from './pages/Resources'
import CostList from './pages/CostList'
import Approval from './pages/Approval'
import DeliveryList from './pages/DeliveryList'
import DeliveryDetail from './pages/DeliveryDetail'
import Special from './pages/Special'
import ContractList from './pages/ContractList'
import ContractEdit from './pages/ContractEdit'
import ContractDetail from './pages/ContractDetail'
import Customer from './pages/Customer'
import Opportunities from './pages/Opportunities'
import ProductList from './pages/ProductList'
import ProductTypes from './pages/ProductTypes'
import ProductSpecs from './pages/ProductSpecs'
import ProductBom from './pages/ProductBom'
import Materials from './pages/Materials'
import CostCenters from './pages/CostCenters'
import CostItems from './pages/CostItems'
import ChainMap from './pages/ChainMap'
import Bills from './pages/Bills'
import BillDetail from './pages/BillDetail'
import PurchaseContracts from './pages/PurchaseContracts'
import PurchaseReqs from './pages/PurchaseReqs'
import PurchaseOrders from './pages/PurchaseOrders'
import PurchaseOrderDetail from './pages/PurchaseOrderDetail'
import ApprovalConfig from './pages/ApprovalConfig'
import SettingsPage from './pages/Settings'
import Payments from './pages/Payments'
import InvoiceApps from './pages/InvoiceApps'
import Overdue from './pages/Overdue'
import Billing from './pages/Billing'
import Lifecycle from './pages/Lifecycle'
import Settle from './pages/Settle'
import FinanceCenter from './pages/FinanceCenter'
import Notifications from './pages/Notifications'
import SystemUsers from './pages/SystemUsers'
import Claims from './pages/Claims'

export default function App() {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
      <Route path="/" element={<Home />} />
      <Route path="/workbench" element={<Workbench />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/resources" element={<Navigate to="/resources/r1" replace />} />
      <Route path="/resources/chain-map" element={<ChainMap />} />
      <Route path="/resources/r5" element={<Navigate to="/purchase/orders" replace />} />
      <Route path="/resources/:key" element={<Resources />} />
      <Route path="/cost" element={<CostList />} />
      <Route path="/approval" element={<Approval />} />
      <Route path="/delivery" element={<DeliveryList />} />
      <Route path="/delivery/detail" element={<DeliveryDetail />} />
      <Route path="/special" element={<Special />} />
      <Route path="/contract" element={<ContractList />} />
      <Route path="/contract/edit" element={<ContractEdit />} />
      <Route path="/contract/detail" element={<ContractDetail />} />
      <Route path="/customer" element={<Customer />} />
      <Route path="/opportunity" element={<Opportunities />} />
      <Route path="/product" element={<ProductList />} />
      <Route path="/product/types" element={<ProductTypes />} />
      <Route path="/product/specs" element={<ProductSpecs />} />
      <Route path="/product/bom" element={<ProductBom />} />
      <Route path="/materials" element={<Materials />} />
      <Route path="/cost-centers" element={<CostCenters />} />
      <Route path="/cost-items" element={<CostItems />} />
      <Route path="/bills" element={<Bills />} />
      <Route path="/bills/detail" element={<BillDetail />} />
      <Route path="/purchase/contracts" element={<PurchaseContracts />} />
      <Route path="/purchase/reqs" element={<PurchaseReqs />} />
      <Route path="/purchase/orders" element={<PurchaseOrders />} />
      <Route path="/purchase/orders/:poNo" element={<PurchaseOrderDetail />} />
      <Route path="/system/approval" element={<ApprovalConfig />} />
      <Route path="/system/users" element={<SystemUsers />} />
      <Route path="/system/entities" element={<Entities />} />
      <Route path="/system/settings" element={<SettingsPage />} />
      <Route path="/finance" element={<FinanceCenter />} />
      <Route path="/finance/payments" element={<Payments />} />
      <Route path="/finance/invoices" element={<InvoiceApps />} />
      <Route path="/finance/overdue" element={<Overdue />} />
      <Route path="/billing" element={<Billing />} />
      <Route path="/lifecycle" element={<Lifecycle />} />
      <Route path="/finance/claims" element={<Claims />} />
      <Route path="/finance/settle" element={<Settle />} />
      <Route path="/notifications" element={<Notifications />} />
      </Route>
    </Routes>
  )
}
