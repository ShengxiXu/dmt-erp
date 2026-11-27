package com.dmt.erp.approval.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.approval.dto.FlowSaveReq;
import com.dmt.erp.approval.entity.AprFlowDef;
import com.dmt.erp.approval.entity.AprFlowNode;
import com.dmt.erp.approval.mapper.AprFlowDefMapper;
import com.dmt.erp.approval.mapper.AprFlowNodeMapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AprFlowService {

    private final AprFlowDefMapper flowDefMapper;
    private final AprFlowNodeMapper flowNodeMapper;

    public List<AprFlowDef> list() {
        return flowDefMapper.selectList(new LambdaQueryWrapper<AprFlowDef>().orderByAsc(AprFlowDef::getId));
    }

    public List<AprFlowNode> nodes(Long flowId) {
        return flowNodeMapper.selectList(new LambdaQueryWrapper<AprFlowNode>()
                .eq(AprFlowNode::getFlowId, flowId).orderByAsc(AprFlowNode::getSeq));
    }

    @Transactional
    public Long create(FlowSaveReq req) {
        AprFlowDef f = toDef(req);
        f.setEnabled(req.getEnabled() == null ? 1 : req.getEnabled());
        flowDefMapper.insert(f);
        saveNodes(f.getId(), req);
        return f.getId();
    }

    @Transactional
    public void update(FlowSaveReq req) {
        AprFlowDef f = flowDefMapper.selectById(req.getId());
        if (f == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "审批流不存在");
        }
        AprFlowDef patch = toDef(req);
        patch.setId(f.getId());
        patch.setEnabled(req.getEnabled() == null ? f.getEnabled() : req.getEnabled());
        flowDefMapper.updateById(patch);
        saveNodes(f.getId(), req);
    }

    public void toggleEnabled(Long id, Integer enabled) {
        AprFlowDef f = flowDefMapper.selectById(id);
        if (f == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "审批流不存在");
        }
        f.setEnabled(enabled);
        flowDefMapper.updateById(f);
    }

    public void delete(Long id) {
        flowDefMapper.deleteById(id);
        flowNodeMapper.delete(new LambdaQueryWrapper<AprFlowNode>().eq(AprFlowNode::getFlowId, id));
    }

    private AprFlowDef toDef(FlowSaveReq req) {
        AprFlowDef f = new AprFlowDef();
        f.setName(req.getName());
        f.setDocType(req.getDocType());
        f.setTriggerAction(req.getTriggerAction());
        f.setConditionExpr(req.getConditionExpr());
        return f;
    }

    private void saveNodes(Long flowId, FlowSaveReq req) {
        flowNodeMapper.delete(new LambdaQueryWrapper<AprFlowNode>().eq(AprFlowNode::getFlowId, flowId));
        if (req.getNodes() == null) {
            return;
        }
        List<AprFlowNode> nodes = req.getNodes().stream().filter(n -> n.getName() != null && !n.getName().isBlank())
                .map(n -> {
                    AprFlowNode node = new AprFlowNode();
                    node.setFlowId(flowId);
                    node.setSeq(n.getSeq());
                    node.setName(n.getName());
                    node.setApproverType(n.getApproverType());
                    node.setApproverRef(n.getApproverRef());
                    return node;
                }).collect(Collectors.toList());
        nodes.forEach(flowNodeMapper::insert);
    }
}
