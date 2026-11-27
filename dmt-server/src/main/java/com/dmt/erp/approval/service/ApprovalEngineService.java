package com.dmt.erp.approval.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.approval.entity.*;
import com.dmt.erp.approval.mapper.*;
import com.dmt.erp.approval.vo.InstanceVo;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import com.dmt.erp.sys.entity.SysRole;
import com.dmt.erp.sys.entity.SysUser;
import com.dmt.erp.sys.entity.SysUserRole;
import com.dmt.erp.sys.mapper.SysRoleMapper;
import com.dmt.erp.sys.mapper.SysUserMapper;
import com.dmt.erp.sys.mapper.SysUserRoleMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.expression.MapAccessor;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 审批引擎（契约 §4.3，后端最重模块）：
 * 提交 → 按「单据类型 + 触发动作」匹配已启用流程，condition_expr 用 SpEL 按表单字段路由（分支）；
 * 审批 → 当前节点审批人解析（USER/ROLE/DEPT_LEADER），apr_node_record 唯一约束天然幂等防双人穿透；
 * 写回 → 全部通过/驳回触发注册式写回钩子（业务侧 monopoly 单据状态）。
 */
@Slf4j
@Service
public class ApprovalEngineService {

    private final AprFlowDefMapper flowDefMapper;
    private final AprFlowNodeMapper flowNodeMapper;
    private final AprInstanceMapper instanceMapper;
    private final AprNodeRecordMapper nodeRecordMapper;
    private final AprWritebackMapper writebackMapper;
    private final SysUserMapper userMapper;
    private final SysRoleMapper roleMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final WritebackRegistry registry;

    public ApprovalEngineService(AprFlowDefMapper flowDefMapper, AprFlowNodeMapper flowNodeMapper,
                                 AprInstanceMapper instanceMapper, AprNodeRecordMapper nodeRecordMapper,
                                 AprWritebackMapper writebackMapper, SysUserMapper userMapper,
                                 SysRoleMapper roleMapper, SysUserRoleMapper userRoleMapper,
                                 WritebackRegistry registry) {
        this.flowDefMapper = flowDefMapper;
        this.flowNodeMapper = flowNodeMapper;
        this.instanceMapper = instanceMapper;
        this.nodeRecordMapper = nodeRecordMapper;
        this.writebackMapper = writebackMapper;
        this.userMapper = userMapper;
        this.roleMapper = roleMapper;
        this.userRoleMapper = userRoleMapper;
        this.registry = registry;
    }

    // ---------- 提交 ----------

    /** 提交单据：命中流程则实例化并返回实例；未命中返回 null（调用方走页面默认模板兜底） */
    @Transactional
    public AprInstance submit(String docType, String triggerAction, Long docId, Map<String, Object> form) {
        List<AprFlowDef> flows = flowDefMapper.selectList(new LambdaQueryWrapper<AprFlowDef>()
                .eq(AprFlowDef::getDocType, docType)
                .eq(AprFlowDef::getTriggerAction, triggerAction)
                .eq(AprFlowDef::getEnabled, 1)
                .orderByAsc(AprFlowDef::getId));
        AprFlowDef hit = null;
        for (AprFlowDef f : flows) {
            if (match(f.getConditionExpr(), form)) {
                hit = f;
                break;
            }
        }
        if (hit == null) {
            return null;
        }
        List<AprFlowNode> nodes = nodesOf(hit.getId());
        if (nodes.isEmpty()) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "审批流「" + hit.getName() + "」未配置节点");
        }
        AprInstance inst = new AprInstance();
        inst.setFlowId(hit.getId());
        inst.setDocType(docType);
        inst.setDocId(docId);
        inst.setStatus("审批中");
        inst.setCurSeq(nodes.get(0).getSeq());
        instanceMapper.insert(inst);
        return inst;
    }

    /** SpEL 条件分支：空条件恒真；如 discount > 0 && amount > 100000 */
    private boolean match(String conditionExpr, Map<String, Object> form) {
        if (!StringUtils.hasText(conditionExpr)) {
            return true;
        }
        try {
            StandardEvaluationContext ctx = new StandardEvaluationContext(form);
            ctx.addPropertyAccessor(new MapAccessor());
            Boolean r = new SpelExpressionParser().parseExpression(conditionExpr).getValue(ctx, Boolean.class);
            return Boolean.TRUE.equals(r);
        } catch (Exception e) {
            log.warn("condition eval failed: {} form={}", conditionExpr, form, e);
            return false;
        }
    }

    private List<AprFlowNode> nodesOf(Long flowId) {
        return flowNodeMapper.selectList(new LambdaQueryWrapper<AprFlowNode>()
                .eq(AprFlowNode::getFlowId, flowId).orderByAsc(AprFlowNode::getSeq));
    }

    // ---------- 审批动作 ----------

    @Transactional
    public void act(Long instanceId, boolean approve, String comment) {
        LoginUser me = SecurityUtils.requireUser();
        AprInstance inst = mustGet(instanceId);
        if (!"审批中".equals(inst.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "实例已结束，不能重复审批");
        }
        AprFlowNode node = currentNode(inst);
        Set<Long> approvers = resolveApprovers(node, inst);
        if (!approvers.contains(me.getUserId())) {
            throw new BizException(ResultCode.FORBIDDEN, "你不是当前节点的审批人");
        }
        // 幂等 + 防双人穿透：同一实例同一节点只允许一条记录
        Long exists = nodeRecordMapper.selectCount(new LambdaQueryWrapper<AprNodeRecord>()
                .eq(AprNodeRecord::getInstanceId, inst.getId())
                .eq(AprNodeRecord::getSeq, inst.getCurSeq()));
        if (exists > 0) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该节点已有人审批，请刷新查看结果");
        }
        if (!approve && !StringUtils.hasText(comment)) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "驳回必须填写审批意见");
        }
        AprNodeRecord record = new AprNodeRecord();
        record.setInstanceId(inst.getId());
        record.setSeq(inst.getCurSeq());
        record.setApproverId(me.getUserId());
        record.setResult(approve ? "通过" : "驳回");
        record.setComment(comment);
        record.setActedAt(LocalDateTime.now());
        nodeRecordMapper.insert(record);

        if (!approve) {
            inst.setStatus("已驳回");
            instanceMapper.updateById(inst);
            writeback(inst, false);
            return;
        }
        List<AprFlowNode> nodes = nodesOf(inst.getFlowId());
        Optional<AprFlowNode> next = nodes.stream().filter(n -> n.getSeq() > inst.getCurSeq()).findFirst();
        if (next.isPresent()) {
            inst.setCurSeq(next.get().getSeq());
            instanceMapper.updateById(inst);
        } else {
            inst.setStatus("已通过");
            instanceMapper.updateById(inst);
            writeback(inst, true);
        }
    }

    private AprFlowNode currentNode(AprInstance inst) {
        return flowNodeMapper.selectOne(new LambdaQueryWrapper<AprFlowNode>()
                .eq(AprFlowNode::getFlowId, inst.getFlowId())
                .eq(AprFlowNode::getSeq, inst.getCurSeq()));
    }

    /** 节点审批人解析：USER=指定人 / ROLE=角色下全部用户 / DEPT_LEADER=发起人同部门用户 */
    public Set<Long> resolveApprovers(AprFlowNode node, AprInstance inst) {
        if (node == null) {
            return Set.of();
        }
        return switch (node.getApproverType()) {
            case "USER" -> Set.of(Long.valueOf(node.getApproverRef()));
            case "ROLE" -> usersOfRole(node.getApproverRef());
            default -> usersOfDept(submitterDept(inst));
        };
    }

    private Set<Long> usersOfRole(String roleCode) {
        SysRole role = roleMapper.selectOne(new LambdaQueryWrapper<SysRole>().eq(SysRole::getCode, roleCode));
        if (role == null) {
            return Set.of();
        }
        return userRoleMapper.selectList(new LambdaQueryWrapper<SysUserRole>()
                        .eq(SysUserRole::getRoleId, role.getId()))
                .stream().map(SysUserRole::getUserId).collect(Collectors.toSet());
    }

    private Long submitterDept(AprInstance inst) {
        SysUser u = inst.getCreatedBy() == null ? null : userMapper.selectById(inst.getCreatedBy());
        return u == null ? null : u.getDeptId();
    }

    private Set<Long> usersOfDept(Long deptId) {
        if (deptId == null) {
            return Set.of();
        }
        return userMapper.selectList(new LambdaQueryWrapper<SysUser>().eq(SysUser::getDeptId, deptId))
                .stream().map(SysUser::getId).collect(Collectors.toSet());
    }

    public String approverLabel(AprFlowNode node) {
        if (node == null) {
            return "—";
        }
        return switch (node.getApproverType()) {
            case "USER" -> {
                SysUser u = userMapper.selectById(Long.valueOf(node.getApproverRef()));
                yield u == null ? node.getApproverRef() : u.getName();
            }
            case "ROLE" -> {
                SysRole r = roleMapper.selectOne(new LambdaQueryWrapper<SysRole>().eq(SysRole::getCode, node.getApproverRef()));
                yield (r == null ? node.getApproverRef() : r.getName()) + "（角色）";
            }
            default -> "部门负责人";
        };
    }

    private void writeback(AprInstance inst, boolean pass) {
        AprWriteback logRow = new AprWriteback();
        logRow.setInstanceId(inst.getId());
        logRow.setHook(inst.getDocType());
        logRow.setPayload("{\"docId\":" + inst.getDocId() + ",\"pass\":" + pass + "}");
        try {
            var hook = registry.hook(inst.getDocType());
            if (hook != null) {
                hook.accept(inst.getDocId(), pass);
            }
            logRow.setResult("ok");
        } catch (Exception e) {
            log.error("writeback failed: {} doc={}", inst.getDocType(), inst.getDocId(), e);
            logRow.setResult("error:" + e.getMessage());
        }
        writebackMapper.insert(logRow);
    }

    // ---------- 重新提交 ----------

    @Transactional
    public AprInstance resubmit(Long instanceId) {
        AprInstance old = mustGet(instanceId);
        var provider = registry.formProvider(old.getDocType());
        Map<String, Object> form = provider == null ? Map.of() : provider.apply(old.getDocId());
        AprInstance inst = submit(old.getDocType(), "提交", old.getDocId(), form);
        if (inst == null) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "未命中已启用的审批流，无法重新提交");
        }
        return inst;
    }

    /** 单据在途实例（用于接管判断与详情渲染） */
    public AprInstance activeInstance(String docType, Long docId) {
        return instanceMapper.selectOne(new LambdaQueryWrapper<AprInstance>()
                .eq(AprInstance::getDocType, docType)
                .eq(AprInstance::getDocId, docId)
                .eq(AprInstance::getStatus, "审批中")
                .orderByDesc(AprInstance::getId)
                .last("LIMIT 1"));
    }

    // ---------- 查询 ----------

    public InstanceVo detail(Long instanceId) {
        return toVo(mustGet(instanceId));
    }

    private AprInstance mustGet(Long id) {
        AprInstance inst = instanceMapper.selectById(id);
        if (inst == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "审批实例不存在");
        }
        return inst;
    }

    /** 待我审批：在途实例按当前节点解析审批人过滤 */
    public PageResult<InstanceVo> todo(long pageNum, long pageSize) {
        LoginUser me = SecurityUtils.requireUser();
        List<AprInstance> all = instanceMapper.selectList(new LambdaQueryWrapper<AprInstance>()
                .eq(AprInstance::getStatus, "审批中").orderByDesc(AprInstance::getId));
        List<InstanceVo> mine = all.stream()
                .filter(i -> resolveApprovers(currentNode(i), i).contains(me.getUserId()))
                .map(this::toVo)
                .collect(Collectors.toList());
        return pageInMemory(mine, pageNum, pageSize);
    }

    /** 我已办：我签过字的节点记录 → 实例 */
    public PageResult<InstanceVo> done(long pageNum, long pageSize) {
        LoginUser me = SecurityUtils.requireUser();
        List<AprNodeRecord> records = nodeRecordMapper.selectList(new LambdaQueryWrapper<AprNodeRecord>()
                .eq(AprNodeRecord::getApproverId, me.getUserId()).orderByDesc(AprNodeRecord::getId));
        List<InstanceVo> list = records.stream()
                .map(r -> instanceMapper.selectById(r.getInstanceId()))
                .filter(Objects::nonNull)
                .distinct()
                .map(this::toVo)
                .collect(Collectors.toList());
        return pageInMemory(list, pageNum, pageSize);
    }

    private PageResult<InstanceVo> pageInMemory(List<InstanceVo> list, long pageNum, long pageSize) {
        PageResult<InstanceVo> r = new PageResult<>();
        r.setTotal(list.size());
        r.setPageNum(pageNum);
        r.setPageSize(pageSize);
        int from = (int) Math.min((pageNum - 1) * pageSize, list.size());
        int to = (int) Math.min(from + pageSize, list.size());
        r.setRecords(list.subList(from, to));
        return r;
    }

    private InstanceVo toVo(AprInstance inst) {
        InstanceVo vo = new InstanceVo();
        org.springframework.beans.BeanUtils.copyProperties(inst, vo);
        AprFlowDef flow = flowDefMapper.selectById(inst.getFlowId());
        vo.setFlowName(flow == null ? "—" : flow.getName());
        vo.setDocSummary(registry.summary(inst.getDocType(), inst.getDocId()));
        SysUser submitter = inst.getCreatedBy() == null ? null : userMapper.selectById(inst.getCreatedBy());
        vo.setSubmitter(submitter == null ? "—" : submitter.getName());
        List<AprFlowNode> nodes = nodesOf(inst.getFlowId());
        Map<Integer, AprNodeRecord> records = nodeRecordMapper.selectList(new LambdaQueryWrapper<AprNodeRecord>()
                        .eq(AprNodeRecord::getInstanceId, inst.getId()))
                .stream().collect(Collectors.toMap(AprNodeRecord::getSeq, r -> r, (a, b) -> a));
        List<InstanceVo.NodeVo> nodeVos = new ArrayList<>();
        for (AprFlowNode n : nodes) {
            InstanceVo.NodeVo nv = new InstanceVo.NodeVo();
            nv.setSeq(n.getSeq());
            nv.setName(n.getName());
            nv.setApproverLabel(approverLabel(n));
            AprNodeRecord rec = records.get(n.getSeq());
            if (rec != null) {
                nv.setResult(rec.getResult());
                nv.setComment(rec.getComment());
                nv.setActedAt(rec.getActedAt() == null ? null : rec.getActedAt().toString());
                SysUser a = rec.getApproverId() == null ? null : userMapper.selectById(rec.getApproverId());
                nv.setActor(a == null ? null : a.getName());
            }
            nv.setCurrent("审批中".equals(inst.getStatus()) && Objects.equals(inst.getCurSeq(), n.getSeq()));
            nodeVos.add(nv);
        }
        vo.setNodes(nodeVos);
        return vo;
    }
}
