import { useState } from "react";
import { Plus, Landmark, ShieldCheck, PencilLine } from "lucide-react";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { ENTITIES, type Entity, type EntitySeal } from "@/data/entities";

/** 印章配色：按类型区分 */
const SEAL_STYLE: Record<EntitySeal["type"], string> = {
  公章: "border-[#F53F3F] text-[#F53F3F]",
  合同专用章: "border-[#165DFF] text-[#165DFF]",
  财务专用章: "border-[#FF7D00] text-[#FF7D00]",
  发票专用章: "border-[#722ED1] text-[#722ED1]",
};

/** 主体与印章：分子公司抬头 / 税号 / 收款账户 / 在册印章的唯一维护入口 */
export default function Entities() {
  const [list, setList] = useState<Entity[]>(ENTITIES);
  const [form, setForm] = useState<{ open: boolean; init?: Entity }>({ open: false });

  const openNew = () => setForm({ open: true });
  const openEdit = (e: Entity) => setForm({ open: true, init: e });
  const close = () => setForm({ open: false });
  const save = (e: Entity) => {
    const idx = list.findIndex((x) => x.id === e.id);
    if (idx >= 0) { const next = [...list]; next[idx] = e; setList(next); }
    else { ENTITIES.push(e); setList([...list, e]); }
    close();
  };

  return (
    <ArcoShell breadcrumb="主体与印章">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-[18px] font-semibold">
              <span className="h-5 w-1 rounded-full bg-gradient-to-b from-[#165DFF] to-[#4080FF]" />主体与印章
            </h1>
            <p className="mt-1 text-[13px] text-[#86909C]">
              分子公司法人主体档案：合同 / 开票抬头、税号、收款账户、在册印章。销售合同与采购合同签约时必须选择主体，抬头与用印由主体决定。
            </p>
          </div>
          <button onClick={openNew} className="flex h-9 items-center gap-1.5 rounded-[2px] bg-[#165DFF] px-4 text-[14px] text-white hover:bg-[#0E4FDB]">
            <Plus size={15} /> 新增主体
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {list.map((e) => (
            <section key={e.id} className="rounded-[6px] border border-[#E5E6EB] bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(22,93,255,0.10)]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-gradient-to-br from-[#165DFF] to-[#4080FF] text-white">
                    <Landmark size={19} strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-[#1D2129]">{e.shortName}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#86909C]">
                      <span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5">{e.nature}</span>
                      <span className={e.status === "启用" ? "text-[#00B42A]" : "text-[#86909C]"}>{e.status}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => openEdit(e)} className="flex h-7 items-center gap-1 rounded-[2px] border border-[#E5E6EB] px-2.5 text-[12px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">
                  <PencilLine size={13} /> 编辑
                </button>
              </div>

              <dl className="mt-4 space-y-1.5 text-[13px] leading-5">
                <div className="flex justify-between gap-3"><dt className="shrink-0 text-[#86909C]">抬头全称</dt><dd className="text-right font-medium text-[#1D2129]">{e.fullName}</dd></div>
                <div className="flex justify-between gap-3"><dt className="shrink-0 text-[#86909C]">税号</dt><dd className="font-mono text-[12px] text-[#4E5969]">{e.taxNo}</dd></div>
                <div className="flex justify-between gap-3"><dt className="shrink-0 text-[#86909C]">收款账户</dt><dd className="text-right text-[#4E5969]">{e.bank} · {e.account}</dd></div>
              </dl>

              <div className="mt-4 border-t border-[#F2F3F5] pt-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] text-[#86909C]">
                  <ShieldCheck size={13} /> 在册印章（{e.seals.length} 枚）
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.seals.map((s) => (
                    <span key={s.name} title={s.name}
                      className={`flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] text-[10px] font-semibold leading-tight ${SEAL_STYLE[s.type]}`}
                      style={{ padding: 3 }}>
                      <span className="flex h-full w-full items-center justify-center rounded-full border border-current text-center">{s.type}</span>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[12px] leading-5 text-[#86909C]">
          口径：一份销售合同 / 采购合同只能落一个主体；主体决定合同抬头、用印（线上契约锁按主体开通企业章，线下按主体加盖实物章）、开票销方税号与收款账户。月结与毛利分析如需按主体分列，可在成本中心上挂主体（二期）。
        </div>
      </main>

      {form.open && <EntityForm init={form.init} onClose={close} onSave={save} />}
    </ArcoShell>
  );
}

function EntityForm({ init, onClose, onSave }: { init?: Entity; onClose: () => void; onSave: (e: Entity) => void }) {
  const [f, setF] = useState<Entity>(init ?? {
    id: `ENT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    shortName: "", fullName: "", nature: "法人公司", taxNo: "", bank: "", account: "",
    seals: [{ name: "", type: "公章" }], status: "启用",
  });
  const set = (patch: Partial<Entity>) => setF((x) => ({ ...x, ...patch }));

  return (
    <CenterModal title={init ? "编辑主体" : "新增主体"} sub="抬头 / 税号 / 收款账户 / 印章" width={560} onClose={onClose}>
      <div className="space-y-3 text-[13px]">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[#4E5969]">简称 <b className="text-[#F53F3F]">*</b></span>
            <input className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5" value={f.shortName} onChange={(e) => set({ shortName: e.target.value })} placeholder="如：地面通信息（上海总部）" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[#4E5969]">主体性质</span>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5" value={f.nature} onChange={(e) => set({ nature: e.target.value as Entity["nature"] })}>
              <option>法人公司</option><option>分公司</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[#4E5969]">抬头全称（合同 / 开票）<b className="text-[#F53F3F]">*</b></span>
          <input className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5" value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="工商注册全称" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[#4E5969]">统一社会信用代码（销方税号）</span>
          <input className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 font-mono" value={f.taxNo} onChange={(e) => set({ taxNo: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[#4E5969]">收款开户行</span>
            <input className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5" value={f.bank} onChange={(e) => set({ bank: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[#4E5969]">收款账号</span>
            <input className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 font-mono" value={f.account} onChange={(e) => set({ account: e.target.value })} />
          </label>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[#4E5969]">在册印章</span>
            <button type="button" className="text-[12px] text-[#165DFF] hover:underline"
              onClick={() => set({ seals: [...f.seals, { name: "", type: "合同专用章" }] })}>+ 加一枚</button>
          </div>
          <div className="space-y-2">
            {f.seals.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input className="flex-1 rounded-[2px] border border-[#E5E6EB] px-2 py-1.5" value={s.name}
                  placeholder={`${f.fullName || "主体全称"}××章`} onChange={(e) => set({ seals: f.seals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <select className="w-32 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5" value={s.type}
                  onChange={(e) => set({ seals: f.seals.map((x, j) => (j === i ? { ...x, type: e.target.value as EntitySeal["type"] } : x)) })}>
                  {["公章", "合同专用章", "财务专用章", "发票专用章"].map((t) => <option key={t}>{t}</option>)}
                </select>
                {f.seals.length > 1 && (
                  <button type="button" className="text-[#86909C] hover:text-[#F53F3F]" onClick={() => set({ seals: f.seals.filter((_, j) => j !== i) })}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="h-8 rounded-[2px] border border-[#E5E6EB] px-4 text-[13px] text-[#4E5969] hover:bg-[#F7F8FA]" onClick={onClose}>取消</button>
          <button className="h-8 rounded-[2px] bg-[#165DFF] px-4 text-[13px] text-white hover:bg-[#0E4FDB]"
            onClick={() => f.shortName && f.fullName && onSave({ ...f, seals: f.seals.filter((s) => s.name) })}>保存</button>
        </div>
      </div>
    </CenterModal>
  );
}
