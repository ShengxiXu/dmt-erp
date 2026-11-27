// 业务单据归属人解析：合同 / 核算单 / 特批等单据本身不直接挂归属人，沿「商机 → 客户」链路解析
// 口径：dealId 命中的商机归属人优先，其次客户档案归属人；两者都查不到 = 无归属人（仅「全部数据」可见，收敛默认）
import { CUSTOMERS, GET_OPP } from "@/data/customers";

export const ownerOfDeal = (dealId: string | undefined, customerName: string | undefined): string | undefined =>
  (dealId ? GET_OPP(dealId)?.sales : undefined) ?? CUSTOMERS.find((c) => c.name === customerName)?.sales;
