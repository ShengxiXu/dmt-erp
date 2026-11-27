-- V8：合同版本历史（签署/审批/修订动作留痕）
ALTER TABLE mdm_contract
  ADD COLUMN versions_json JSON NULL COMMENT '版本历史 [{v,note,at}]' AFTER terms;
