// 登录页（/login，独立布局，不进侧边导航）：账号密码 / 手机验证码两种方式
// 演示环境无短信网关：验证码生成后直接在页面提示（正式环境替换为短信下发，sendSmsCode 的返回值不变）
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { KeyRound, MessageSquareText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { USERS, loginByPassword, loginBySms, sendSmsCode } from "@/data/users";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"pwd" | "sms">("pwd");

  // 账号密码
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  // 手机验证码
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const startCountdown = () => {
    setCountdown(60);
    timer.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1 && timer.current) clearInterval(timer.current);
        return c - 1;
      });
    }, 1000);
  };

  const doPwdLogin = () => {
    setError("");
    setBusy(true);
    const r = loginByPassword(account, password);
    setBusy(false);
    if (r.ok) navigate("/workbench", { replace: true }); // 登录后默认落地页：工作台
    else setError(r.error ?? "登录失败，请重试");
  };

  const doSendCode = () => {
    setError("");
    const r = sendSmsCode(phone);
    if (!r.ok) { setError(r.error ?? "发送失败"); return; }
    setDemoCode(r.code ?? null);
    startCountdown();
  };

  const doSmsLogin = () => {
    setError("");
    setBusy(true);
    const r = loginBySms(phone, code);
    setBusy(false);
    if (r.ok) navigate("/workbench", { replace: true }); // 登录后默认落地页：工作台
    else setError(r.error ?? "登录失败，请重试");
  };

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      {/* 左侧品牌区 */}
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-[#1D2B64] via-[#2B3A8F] to-[#4658C8] p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/15 text-[18px] font-bold text-white backdrop-blur">D</span>
          <div>
            <div className="text-[17px] font-semibold text-white">DMT-ERP</div>
            <div className="text-[12px] text-white/60">交付与核算系统</div>
          </div>
        </div>
        <div>
          <div className="text-[28px] font-semibold leading-snug text-white">合同签订之后的交付与核算，<br />一条主线管到底。</div>
          <div className="mt-4 max-w-md text-[13px] leading-6 text-white/60">已签合同同步建档 → 成本核算双部门填报 → 审批 → 开通工单 → 资源绑定扣减 → 计费出账与月结。</div>
        </div>
        <div className="text-[12px] text-white/40">上海地面通信息网络有限公司 · 第一期原型</div>
      </div>

      {/* 右侧登录卡 */}
      <div className="flex w-full items-center justify-center px-6 lg:w-[520px] lg:shrink-0">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 lg:hidden">
            <div className="text-[20px] font-semibold text-[#1D2129]">DMT-ERP 交付与核算系统</div>
          </div>
          <div className="rounded-[8px] border border-[#E5E6EB] bg-white p-8 shadow-[0_8px_30px_rgba(29,43,100,0.06)]">
            <div className="mb-1 text-[20px] font-semibold text-[#1D2129]">登录</div>
            <div className="mb-6 text-[12px] text-[#86909C]">使用公司分配的账号登录系统</div>

            {/* 方式切换 */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-[6px] bg-[#F2F3F5] p-1">
              {([["pwd", "账号密码登录", KeyRound], ["sms", "手机验证码登录", MessageSquareText]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => { setMode(k); setError(""); }}
                  className={`flex items-center justify-center gap-1.5 rounded-[4px] py-1.5 text-[13px] transition-colors ${mode === k ? "bg-white font-medium text-[#165DFF] shadow-sm" : "text-[#4E5969] hover:text-[#1D2129]"}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            {mode === "pwd" ? (
              <div className="space-y-3.5">
                <div>
                  <div className="mb-1 text-xs text-[#4E5969]">账号</div>
                  <Input value={account} placeholder="登录账号 / 姓名 / 手机号" autoFocus
                    onChange={(e) => setAccount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doPwdLogin()} />
                </div>
                <div>
                  <div className="mb-1 text-xs text-[#4E5969]">密码</div>
                  <Input type="password" value={password} placeholder="请输入密码"
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doPwdLogin()} />
                </div>
                {error && <div className="rounded-[4px] bg-[#FFECE8] px-3 py-2 text-[12px] text-[#F53F3F]">{error}</div>}
                <Button className="w-full" disabled={busy} onClick={doPwdLogin}>{busy ? "登录中…" : "登 录"}</Button>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <div className="mb-1 text-xs text-[#4E5969]">手机号</div>
                  <Input value={phone} placeholder="请输入绑定的 11 位手机号" autoFocus
                    onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <div className="mb-1 text-xs text-[#4E5969]">验证码</div>
                  <div className="flex gap-2">
                    <Input value={code} placeholder="6 位验证码"
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doSmsLogin()} />
                    <Button variant="outline" className="shrink-0" disabled={countdown > 0} onClick={doSendCode}>
                      {countdown > 0 ? `${countdown}s 后重发` : "发送验证码"}
                    </Button>
                  </div>
                </div>
                {demoCode && (
                  <div className="rounded-[4px] bg-[#E8F3FF] px-3 py-2 text-[12px] leading-5 text-[#165DFF]">
                    演示环境未接短信网关，本次验证码：<span className="font-mono font-semibold tracking-wider">{demoCode}</span>（10 分钟内有效）
                  </div>
                )}
                {error && <div className="rounded-[4px] bg-[#FFECE8] px-3 py-2 text-[12px] text-[#F53F3F]">{error}</div>}
                <Button className="w-full" disabled={busy} onClick={doSmsLogin}>{busy ? "登录中…" : "登 录"}</Button>
              </div>
            )}

            <div className="mt-6 border-t border-[#F2F3F5] pt-4">
              <div className="mb-2 flex items-center gap-1 text-[11px] text-[#86909C]"><ShieldCheck size={12} /> 演示账号（密码均为 123456）</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] leading-5 text-[#86909C]">
                {USERS.slice(0, 6).map((u) => (
                  <button key={u.id} className="text-left hover:text-[#165DFF]" title={`点击填入账号`}
                    onClick={() => { setMode("pwd"); setAccount(u.account); setPassword("123456"); setError(""); }}>
                    <span className="text-[#4E5969]">{u.name}</span> <span className="font-mono">{u.account}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
