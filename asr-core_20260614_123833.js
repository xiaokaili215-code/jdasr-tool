// ==UserScript==
// @name         VER-ASR审核助手(内置收款码+本地缓存版)
// @namespace    ver.jd.com
// @version      2.5
// @match        https://ver.jd.com/TalentAppealPoolDetail*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==
(function () {
    'use strict';

    // ===================== 核心配置区 =====================
    // 远程核心JS地址
    const REMOTE_CORE_URL = "https://jsd.cdn.zzko.cn/gh/xiaokaili215-code/JDASR-tool@main/asr-core_20260614_123831.js";
    // 核心代码版本号：更新核心文件后，把这个数字改大，就会强制重新拉取
    const CORE_VERSION = "2.5.0";
    // 微信收款码 Base64
    const WECHAT_BASE64 = "此处粘贴微信收款码完整Base64字符串";
    // 支付宝收款码 Base64
    const ALIPAY_BASE64 = "此处粘贴支付宝收款码完整Base64字符串";
    // ======================================================

    // 注入收款码全局数据
    window.ASR_DONATE_DATA = {
        wechatQr: WECHAT_BASE64,
        alipayQr: ALIPAY_BASE64
    };

    const STORAGE_KEY_CODE = 'asr_core_code';
    const STORAGE_KEY_VER = 'asr_core_version';

    async function loadCoreScript() {
        try {
            // 1. 先读本地缓存，版本匹配直接用
            const localVer = GM_getValue(STORAGE_KEY_VER, '');
            const localCode = GM_getValue(STORAGE_KEY_CODE, '');
            
            if (localVer === CORE_VERSION && localCode) {
                // 版本一致，直接执行本地缓存，零网络延迟
                eval(localCode);
                return;
            }

            // 2. 版本不匹配或无缓存，拉取远程代码
            const res = await fetch(REMOTE_CORE_URL);
            if (!res.ok) throw new Error("远程文件加载失败");
            const coreCode = await res.text();

            // 3. 存入本地缓存，记录版本号
            GM_setValue(STORAGE_KEY_CODE, coreCode);
            GM_setValue(STORAGE_KEY_VER, CORE_VERSION);

            // 4. 执行代码
            eval(coreCode);
        } catch (err) {
            console.error("核心模块加载异常：", err);
            
            // 远程加载失败，但本地有旧缓存 → 降级用旧版本
            const localCode = GM_getValue(STORAGE_KEY_CODE, '');
            if (localCode) {
                eval(localCode);
                return;
            }

            // 完全加载失败的提示
            const errorTip = document.createElement("div");
            errorTip.style.cssText = `
                position: fixed;right:20px;top:100px;padding:12px 18px;
                background:#fef0f0;color:#f56c6c;border-radius:6px;
                z-index:999999;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.1);
            `;
            errorTip.innerText = "ASR工具加载失败，请刷新页面重试！";
            document.body.appendChild(errorTip);
        }
    }

    loadCoreScript();
})();