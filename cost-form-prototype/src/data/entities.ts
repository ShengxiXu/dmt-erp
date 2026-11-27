// 签约主体（法人主体）档案：分子公司的合同/开票抬头、税号、收款账户、印章
// 影响面：销售合同（签约主体+用印）、采购合同（采购主体）、开票（销方）、收款（收款账户）
// 口径：一个客户合同只能落一个主体；主体决定抬头、印章、销方税号与收款账户，财务维度按主体分列
export interface EntitySeal { name: string; type: "公章" | "合同专用章" | "财务专用章" | "发票专用章" }

export interface Entity {
  id: string;              // ENT-xxx
  shortName: string;       // 页面显示简称
  fullName: string;        // 合同 / 开票抬头全称
  nature: "法人公司" | "分公司";
  taxNo: string;           // 统一社会信用代码（销方税号）
  bank: string;            // 收款开户行
  account: string;         // 收款账号
  seals: EntitySeal[];     // 在册印章（实物章编号 / 电子章印模）
  status: "启用" | "停用";
}

// ---------- 预置主体（演示数据） ----------
import { persistable } from "@/data/persist";
export const ENTITIES: Entity[] = persistable("entities", () => [
  {
    id: "ENT-HQ", shortName: "地面通信息（上海总部）", fullName: "上海地面通信息技术有限公司",
    nature: "法人公司", taxNo: "91310104MA1FR8Q42A",
    bank: "招商银行上海漕河泾支行", account: "1219 0888 5566 001",
    seals: [
      { name: "上海地面通信息技术有限公司公章", type: "公章" },
      { name: "上海地面通信息技术有限公司合同专用章", type: "合同专用章" },
      { name: "上海地面通信息技术有限公司财务专用章", type: "财务专用章" },
      { name: "上海地面通信息技术有限公司发票专用章", type: "发票专用章" },
    ],
    status: "启用",
  },
  {
    id: "ENT-NET", shortName: "地面通网络（子公司）", fullName: "上海地面通网络科技有限公司",
    nature: "法人公司", taxNo: "91310115MA1K3T7X9B",
    bank: "浦发银行上海张江支行", account: "9881 2233 7788 102",
    seals: [
      { name: "上海地面通网络科技有限公司公章", type: "公章" },
      { name: "上海地面通网络科技有限公司合同专用章", type: "合同专用章" },
      { name: "上海地面通网络科技有限公司发票专用章", type: "发票专用章" },
    ],
    status: "启用",
  },
  {
    id: "ENT-BJ", shortName: "地面通北京（分公司）", fullName: "北京地面通信息技术有限公司上海分公司",
    nature: "分公司", taxNo: "91110108MA01C8Y77C（总公司 91110108MA01C8Y77）",
    bank: "中国银行北京中关村支行", account: "3456 8899 2211 308",
    seals: [
      { name: "北京地面通信息技术有限公司上海分公司公章", type: "公章" },
      { name: "北京地面通信息技术有限公司上海分公司合同专用章", type: "合同专用章" },
    ],
    status: "启用",
  },
]);

export const ENTITY_BY_ID = (id?: string) => ENTITIES.find((e) => e.id === id) ?? ENTITIES[0];
export const ENTITY_NAME = (id?: string) => ENTITY_BY_ID(id).shortName;
