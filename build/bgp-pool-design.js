import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImportedXmlComponent,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("Usage: node bgp-pool-design.js /absolute/path/output.docx");

const T = String.raw;
const title = T`BGP 资源池建模方案`;
const subtitle = T`DMT-ERP 第一期 · 设计评审文档（V1.5 讨论稿）`;
const palette = { dark: "1D2129", primary: "37474F", light: "86909C", border: "D8E0E3", fill: "EEF3F6", accent: "165DFF" };

const font = { ascii: "Times New Roman", hAnsi: "Times New Roman", cs: "Times New Roman", eastAsia: "SimSun" };
const run = (text, options = {}) => new TextRun({ text, font, size: 24, ...options });
const para = (children, options = {}) =>
  new Paragraph({ spacing: { after: 160, line: 300 }, ...options, children: Array.isArray(children) ? children : [children] });
const bodyPara = (text, options = {}) => para(run(text), { indent: { firstLine: convertInchesToTwip(0.33) }, ...options });
const bullet = (text) => para(run(text), { numbering: { reference: "bullets", level: 0 }, spacing: { after: 100, line: 300 } });
const h1 = (text) => para(run(text, { bold: true, size: 30, color: palette.dark }), { heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 } });
const h2 = (text) => para(run(text, { bold: true, size: 26, color: palette.primary }), { heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });

const cell = (text, options = {}) =>
  new TableCell({ children: [para(run(text, { size: 21 }))], margins: { top: 100, bottom: 100, left: 120, right: 120 }, ...options });

const makeTable = (widths, headerRow, dataRows) =>
  new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headerRow.map((t, i) => cell(t, { shading: { type: ShadingType.CLEAR, fill: palette.fill }, width: { size: widths[i], type: WidthType.DXA } })) }),
      ...dataRows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, { width: { size: widths[i], type: WidthType.DXA } })) })),
    ],
  });

const xmlEscape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const toc = (entries) => {
  const cached = entries.map(({ title: t, level, page }) => {
    const indent = Math.max(0, level - 1) * 360;
    return `<w:p><w:pPr><w:pStyle w:val="TOC${level}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9000"/></w:tabs><w:ind w:left="${indent}"/></w:pPr><w:r><w:t>${xmlEscape(t)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>${page}</w:t></w:r></w:p>`;
  }).join("");
  return ImportedXmlComponent.fromXmlString(`<w:sdt xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:sdtPr><w:alias w:val="目录"/></w:sdtPr><w:sdtContent><w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText><w:fldChar w:fldCharType="separate"/></w:r></w:p>${cached}<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:sdtContent></w:sdt>`).root[0];
};

// ---------- 内容数据 ----------
const tocEntries = [
  { title: T`一、背景与问题`, level: 1, page: 2 },
  { title: T`1.1 业务事实`, level: 2, page: 2 },
  { title: T`1.2 系统现状与差距`, level: 2, page: 2 },
  { title: T`二、设计原则与边界`, level: 1, page: 3 },
  { title: T`三、数据结构设计`, level: 1, page: 3 },
  { title: T`3.1 出口池实体（新增一等资源）`, level: 2, page: 3 },
  { title: T`3.2 出口线路档案（R1）改造`, level: 2, page: 4 },
  { title: T`3.3 IP 地址段档案（R3）改造`, level: 2, page: 4 },
  { title: T`3.4 产品 BOM 与核算装配调整`, level: 2, page: 4 },
  { title: T`四、页面与流程改造清单`, level: 1, page: 5 },
  { title: T`五、存量数据迁移`, level: 1, page: 6 },
  { title: T`六、评审待确认问题`, level: 1, page: 6 },
];

const gapTable = makeTable(
  [1900, 3400, 3400],
  [T`现实业务`, T`系统现状`, T`差距`],
  [
    [T`BGP 是自建资源池：三大运营商出口自组，自有 BGP 调度技术`, T`无池实体；"池"只是按归属产品类型聚合出口的虚拟算账口径（r1PoolByProduct）`, T`池不是资源对象，分配 / 负载 / IP 归属都无处挂靠`],
    [T`对客户售卖的单元是池：池容量、BGP 广播 IP 段、池月租；订单进池`, T`工单资源分配按"逐出口多选 + 每条填占用带宽"`, T`填报人被迫替系统做现实中不存在的"客户走哪条出口"选择；绑定扣减按出口写已售，池口径缺失`],
    [T`订单不挂在池内某条出口上，流量按调度策略分摊`, T`出口卡片展示"当前承载 N 家客户业务"明细`, T`池客户被错误记在单条出口头上；无池级负载视图`],
    [T`BGP 广播 IP 段归属池，非单条出口`, T`IP 段绑在出口上（分配需"指向绑定出口"），归属产品类型`, T`与"BGP 广播 IP 段归属池"的概念冲突；广播段与代播段共用地址时无法区分服务对象`],
    [T`成员出口跨产品共享（池内 + 池外直售）`, T`出口单一"归属产品" + "可共享产品类型"松散文本（顿号分隔）`, T`撑不起出口 ↔ 池多对多；共享关系不可校验、不可查询`],
  ],
);

const poolFieldsTable = makeTable(
  [2200, 1400, 4600],
  [T`字段`, T`层级`, T`说明`],
  [
    [T`池编码 / 池名称`, T`①主数据`, T`系统生成编码（如 P-BGP-01）；命名：地域-用途，见名知意`],
    [T`归属产品类型`, T`①主数据`, T`默认"BGP 三网互通"；决定工单分配与核算条目挂接口径`],
    [T`成员出口（多对多）`, T`①主数据`, T`引用 R1 出口档案；一条出口可属多个池，也可同时在池外直售`],
    [T`池容量（M）`, T`①主数据`, T`商用参考指标；准入 = 池已售 + 新单 ≤ 池容量 × 超售比（超售比参数可配，行业参考 2.5~4 : 1）`],
    [T`池月租（元/月）`, T`①主数据`, T`自建池 = 成员出口月租合计（自动汇总，只读）；外部包池采购时为合同值`],
    [T`BGP 广播 IP 段`, T`①主数据`, T`广播至三网出口的地址段（行业内亦称「BGP 多线 IP」）；池档案上选挂 R3 地址段，单向维护（见 3.3）`],
    [T`生效日期 / 状态`, T`①主数据`, T`状态流转：草稿 / 生效 / 停用（停用前须池已售为 0）`],
    [T`池已售带宽（M）`, T`②实时`, T`审批通过订单占用合计，只读、由单据生成`],
    [T`池订单清单`, T`②实时`, T`占用订单明细：客户 / 带宽 / 开通时间 / 到期时间`],
    [T`池实测负载`, T`②实时`, T`近 30 日峰值 ÷ 池容量；工程师定期人工实测录入（周期可配），系统到期提醒、留痕可查`],
    [T`成员变更历史`, T`快照`, T`成员增减、月租变更留痕，历史核算单按当时版本基准计价`],
  ],
);

const changeTable = makeTable(
  [1500, 2500, 4200],
  [T`模块`, T`现状`, T`改造点`],
  [
    [T`资源目录`, T`类清单无池`, T`新增资源类"出口池"（mat_pool），定义属性模板；产品 BOM 物料库同步新增`],
    [T`资源中心`, T`R1 出口 / R2 基础线路 / R3 IP 段 / R4 设备`, T`新增 R0 出口池档案页（台账 + 表单 + ②层实时区）；R1 / R3 按 3.2 / 3.3 改造`],
    [T`工单分配（P02）`, T`四类资源逐出口多选`, T`按产品分配粒度渲染：BGP 三网互通类产品 → 选池 + 填池占用带宽（单选池）；其他产品类型 → 选出口线路不变。绑定扣减：池已售 / 出口已售分层写入`],
    [T`负载展示`, T`出口卡片：峰值负载 + 承载客户明细`, T`新增池卡片（池负载、池订单清单）；出口卡片"承载明细"不再列池客户（池客户归属池）`],
    [T`负载实测录入`, T`无（负载数据为演示预置）`, T`资源中心新增「负载实测录入」：按出口 / 池定期录入实测峰值与利用率，周期可配、到期未录生成待办提醒，历史留痕形成趋势，作为扩容决策依据`],
    [T`成本核算（P01）`, T`池条目为手工文本（"BGP 三网出口池 (I-102+I-103)"）`, T`出口带宽条目挂池档案，选池自动带出池月租；边际计价公式沿用（池月租 ÷（已售 + 本单）× 本单）`],
    [T`月结分摊（P07）`, T`poolSettle 已有池估算 / 执行`, T`沿用；成本对象从"产品类型"细化到"池"`],
    [T`供应商账单对账`, T`账单按出口来票`, T`增加出口 → 池映射，池维度归集上游成本；共用出口按各池占用带宽占比拆池`],
    [T`退订 / 变更`, T`退单释放出口带宽`, T`BGP 订单退订释放池带宽；成员出口退出池时校验影响面（池容量、池内客户）并提示`],
  ],
);

const migrateTable = makeTable(
  [2300, 5200],
  [T`存量对象`, T`迁移动作`],
  [
    [T`BGP 三网互通出口（E-CT-1 / I-102 / I-103）`, T`创建池"P-BGP-01（BGP 三网互通池）"，三条出口挂为成员；出口"归属产品"保留（直售口径），共享文本转为结构化关联`],
    [T`AI 专线 / D-MAN 共享出口`, T`维持现状直售关联；演示数据中与 BGP 共用 E-CT-1 的订单保留为直售明细`],
    [T`BGP 相关 IP 段`, T`归属产品改为池级绑定；原出口绑定降级为冗余路径备注`],
    [T`历史核算单 / 月结记录`, T`不迁移；按历史快照展示，新单据按新模型建档`],
  ],
);

const children = [
  // 封面区
  para(run(title, { bold: true, size: 44, color: palette.dark }), { alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 } }),
  para(run(subtitle, { size: 24, color: palette.light }), { alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
  para(run(T`编制：业务支撑部 × 系统实施 ｜ 日期：2026-11-16 ｜ 状态：讨论稿（未评审）`, { size: 21, color: palette.light }), { alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
  para(run(T`本方案源自"BGP 产品资源池化"业务讨论：BGP 为自建池（三大运营商出口自组、自有 BGP 调度），对客户售卖单元是池而非单条出口，且成员出口可跨产品共享。方案只涉及建模与页面改造设计，暂不改动代码。`, { size: 21, color: palette.primary }), { alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
  para(run("目录", { bold: true, size: 30, color: palette.dark }), { heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }),
  para(run(T`（右键目录 →"更新域"刷新页码）`, { italics: true, size: 20, color: palette.light })),
  toc(tocEntries),
];

// 一、背景与问题
children.push(h1(T`一、背景与问题`));
children.push(h2(T`1.1 业务事实`));
children.push(bullet(T`BGP 产品是自建资源池：向电信 / 联通 / 移动分别采购出口，在自有设备上跑 BGP 调度，池的技术掌控在自己手里`));
children.push(bullet(T`公司资质定位：ISP / IDC 增值电信业务许可 + 全国跨地区运营资质，CNNIC「IP 地址分配联盟」成员（名下持有自有 AS 号与自有广播 IP 段），自研 BGP 三网互通平台专利直连三大运营商骨干`));
children.push(bullet(T`对客户的售卖单元是池：池有总容量、自己的 BGP 广播 IP 段、按池计价；客户订单进池后流量由调度策略分摊到成员出口`));
children.push(bullet(T`不存在"某客户挂在池内某条出口上"的归属关系；单条出口上"承接了哪些客户订单"这个概念对 BGP 不成立`));
children.push(bullet(T`成员出口跨产品共享：同一条出口既在 BGP 池内，也可在池外作为单线接入 / 精品网等产品直售`));
children.push(bullet(T`IP 地址段按来源分两类（R3「来源」字段记录）：自有广播段——归属公司 AS，系统内体现为池；运营商代播段——归属线路合同。段的实际使用由分配动作决定，不按产品预设绑定`));

children.push(h2(T`1.2 系统现状与差距`));
children.push(bodyPara(T`现有系统中"资源 ↔ 产品"是弱对应：产品 BOM 只到资源类（出口线路 / IP 段 / 设备等物料），出口档案上有"归属产品类型 + 可共享产品类型"的松散文本关联，"池"仅是按产品类型聚合出口的虚拟算账口径，不是资源实体。差距如下：`));
children.push(gapTable);

// 二、设计原则与边界
children.push(h1(T`二、设计原则与边界`));
children.push(bullet(T`池提升为一等资源实体：与出口平级，是 BGP 类产品的分配单元、负载单元、成本核算单元`));
children.push(bullet(T`出口 ↔ 池多对多：一条出口可属多个池、也可池外直售；共享关系结构化、可校验、可查询`));
children.push(bullet(T`分配粒度由产品决定：BGP 三网互通类产品绑定池（填池占用带宽），其他产品类型（单线接入、精品网等）绑定出口线路（逐条填占用），工单按产品类型渲染不同分配区`));
children.push(bullet(T`负载口径两层：池级呈现池已售 / 池容量对比，出口级呈现实测利用率；负载实测由工程师定期人工录入——录入周期可配、到期未录生成待办提醒、留痕可查形成趋势，系统不做自动采集与判断；准入与扩容由资源主管人工决策`));
children.push(bullet(T`成本两时点：报价时点边际计价（池月租 ÷（已售 + 本单）× 本单，给销售决策用），月结时点实际分摊（沿用现有 poolSettle，给财务入账用）`));
children.push(bullet(T`明确不做：拥塞处置动作建议、合同「保障等级」字段——拥塞处置是工程师的 QoS / 调度策略现场工作，系统不掺和`));

// 三、数据结构设计
children.push(h1(T`三、数据结构设计`));
children.push(h2(T`3.1 出口池实体（新增一等资源）`));
children.push(bodyPara(T`在资源目录新增资源类"出口池"（mat_pool），资源中心新增 R0 出口池档案。字段设计沿用"①主数据层（人维护、变更留痕）②业务过程层（单据生成、只读）③快照层"三层口径：`));
children.push(poolFieldsTable);

children.push(h2(T`3.2 出口线路档案（R1）改造`));
children.push(bullet(T`新增"所属池"多对多关联字段（引用 R0 池档案），与现有"归属产品类型（直售口径）""可共享产品类型"并存`));
children.push(bullet(T`②层"承载订单清单"拆分口径：直售客户明细照旧；池订单不计入任何单条出口的承载清单，改在池卡片展示`));
children.push(bullet(T`月租拆池规则沿用：共用出口月租按各产品类型（含池）占用带宽占比拆进各自成本池`));

children.push(h2(T`3.3 IP 地址段档案（R3）改造`));
children.push(bodyPara(T`行业内 IP 地址与网络实体的对应关系：归属单对单——自有广播段归属 AS（广播域，系统内体现为池）、运营商代播段归属线路合同；承载多对多——广播段向池内成员出口全量宣告（1:N），代播段主用 1 条 + 备用 1 条。管理粒度为 CIDR 段，单个地址不做主数据。`));
children.push(bullet(T`单向维护：池档案上选挂「池 IP 段」（引用 R3 地址段档案），R3 段上不加归属池字段；运营商代播段维持现状——段上选归属线路，「关联出口线路」1~2 条主备冗余、只增不删。R3 已有「来源：自有 / 运营商代播」字段区分两类`));
children.push(bullet(T`广播段与出口的关联由池派生：成员出口即宣告路径（1:N），不做数据维护；原「绑定出口线路」字段仅对代播段保留`));
children.push(bullet(T`使用与归属解耦：「来源」决定段的归属与计账口径，不限制哪类产品可用——凡流量经本公司 AS 的产品（BGP 三网 / IDC 托管 / 云 / 单线接入）均可分配自有广播段，行业惯例：精品网因卖点是运营商原生 IP 而惯用代播段，托管 / 云默认用自有段`));
children.push(bullet(T`分配校验口径：自有广播段校验其宣告路径（= 池成员出口）是否覆盖本订单使用的出口；代播段校验订单使用线路为段的归属线路（或主备之一）。段的「用途」字段仅作统计分析，不做硬限制`));
children.push(bullet(T`退订释放：BGP 订单退订释放池带宽的同时释放 BGP 广播 IP 段占用；代播段随线路退订一并释放`));

children.push(h2(T`3.4 产品 BOM 与核算装配调整`));
children.push(bullet(T`产品 BOM 层设计不变（产品 → 资源类的引用是对的）；BGP 三网互通类型的"出口线路"物料允许指向池而非逐条出口`));
children.push(bullet(T`核算装配条目"出口带宽租用费"挂池档案：选池自动带出池月租，边际计价公式口径不变`));
children.push(bullet(T`池成员 / 月租变更自动升版本，历史核算单按签订时版本基准计价（沿用现有装配版本机制）`));

// 四、页面与流程改造清单
children.push(h1(T`四、页面与流程改造清单`));
children.push(changeTable);
children.push(bodyPara(T`改造顺序建议：先做数据层（3.1–3.3 字段与档案页）→ 再做工单分配与绑定扣减（P02）→ 最后接入核算与月结。负载展示随资源中心 R0 页一并交付。`));

// 五、存量数据迁移
children.push(h1(T`五、存量数据迁移`));
children.push(migrateTable);

// 六、评审待确认问题
children.push(h1(T`六、评审待确认问题`));
children.push(bullet(T`超售比默认值：BGP 池按 2.5~4 : 1（尽力而为）还是更保守？是否按客户等级差异化设置？`));
children.push(bullet(T`BGP 广播 IP 段与直售 IP 段并存期的过渡规则：存量已按出口分配的地址是否迁移归属？`));
children.push(bullet(T`自建池月租 = 成员出口月租合计的自动汇总口径，财务是否认可（与供应商账单对账的勾稽关系）？`));
children.push(bullet(T`资源中心 R0 档案页与产品定义页的维护权限：池由哪个部门建档、变更走什么审批？`));

const doc = new Document({
  creator: "DMT-ERP",
  title,
  features: { updateFields: true },
  styles: {
    paragraphStyles: [
      { id: "TOC1", name: "TOC 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22 }, paragraph: { spacing: { after: 80 } } },
      { id: "TOC2", name: "TOC 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 21, color: palette.primary }, paragraph: { spacing: { after: 60 } } },
    ],
  },
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.33), hanging: convertInchesToTwip(0.16) } } } }] }] },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [para(run(T`DMT-ERP · BGP 资源池建模方案（讨论稿）`, { size: 18, color: palette.light }), { alignment: AlignmentType.CENTER })] }) },
    footers: { default: new Footer({ children: [para(new TextRun({ children: [PageNumber.CURRENT], font, size: 20 }), { alignment: AlignmentType.CENTER })] }) },
    children,
  }],
});

fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
