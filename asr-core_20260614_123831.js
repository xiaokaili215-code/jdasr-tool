(function () {
    'use strict';
    // ===================== 自定义配置区 =====================
    const TEXT_STYLE = {
        fontSize: '14px',
        color: '#333',
        lineHeight: '1.5',
        fontFamily: 'Microsoft YaHei, sans-serif'
    };
    const HIGHLIGHT_CONFIG = {
        enable: true,
        minMatchLength: 2,
        bgColor: '#fff3cd',
        textColor: '#d97706',
        borderRadius: '2px',
        titleSelector: ''
    };
    const DONATE_CONFIG = {
        enable: true,
        storageKey: 'donate_popup_closed_v24',
        title: '感谢使用 · 请支持一下',
        desc: '如果这个工具对你有帮助，欢迎扫码请作者喝饮料~',
        alipayQr: 'https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVd15qLh1leIt5kAx0fnt8Y-I50xfDxwACNCYAAhZscFUl1QdYp550BTwE.jpg',
        wechatQr: 'https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVd2BqLh4SWKhfNx7MPfdGQs77KofSCgACNiYAAhZscFVY5sMyEY846jwE.png',
        wechatName: '微信',
        alipayName: '支付宝'
    };
    const PANEL_TITLE = 'ASR文本';
    const STORAGE_KEY_POS = 'asr_panel_pos';
    const STORAGE_KEY_SIZE = 'asr_panel_size';
    // ========================================================

    const defaultPos = { right: '20px', top: '80px' };
    const defaultSize = { width: '450px', height: '280px' };
    const panelPos = GM_getValue(STORAGE_KEY_POS, defaultPos);
    const panelSize = GM_getValue(STORAGE_KEY_SIZE, defaultSize);

    let isDragging = false;
    let isResizing = false;
    let dragStartX, dragStartY, panelStartTop, panelStartRight;
    let resizeStartX, resizeStartY, panelStartW, panelStartH;
    let oldUrl = location.href;

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    }

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function preprocessText(text) {
        if (!text) return '';
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    function getTitleElement() {
        if (HIGHLIGHT_CONFIG.titleSelector) {
            return document.querySelector(HIGHLIGHT_CONFIG.titleSelector);
        }
        const titleSpans = document.querySelectorAll('span[title]');
        for (const span of titleSpans) {
            const title = span.title.trim();
            if (title.length >= 5) {
                return span;
            }
        }
        const h1 = document.querySelector('h1');
        if (h1) return h1;
        return null;
    }

    function getTitleText() {
        const el = getTitleElement();
        if (el) return (el.title || el.innerText || '').trim();
        return document.title.trim();
    }

    function getCommonSubstrings(str1, str2, minLen) {
        if (!str1 || !str2 || str1.length < minLen || str2.length < minLen) {
            return [];
        }
        const result = new Set();
        const shortStr = str1.length <= str2.length ? str1 : str2;
        const longStr = str1.length > str2.length ? str1 : str2;

        for (let len = minLen; len <= shortStr.length; len++) {
            for (let i = 0; i <= shortStr.length - len; i++) {
                const substr = shortStr.slice(i, i + len);
                if (longStr.includes(substr)) {
                    result.add(substr);
                }
            }
        }

        const sorted = Array.from(result).sort((a, b) => b.length - a.length);
        const filtered = [];
        for (const word of sorted) {
            const isContained = filtered.some(longWord => longWord.includes(word));
            if (!isContained) {
                filtered.push(word);
            }
        }
        return filtered;
    }

    function highlightTitle(keywords, config) {
        const titleEl = getTitleElement();
        if (!titleEl || keywords.length === 0) return;

        const text = titleEl.innerText.trim();
        let html = escapeHtml(text);
        keywords.forEach(word => {
            const reg = new RegExp(escapeRegExp(word), 'g');
            html = html.replace(reg,
                `<span style="background:${config.bgColor};color:${config.textColor};border-radius:${config.borderRadius};padding:0 2px;">${word}</span>`
            );
        });
        titleEl.innerHTML = html;
    }

    function highlightText(text, keywords, config) {
        const processedText = preprocessText(text);
        let html = escapeHtml(processedText);
        html = html.replace(/\n/g, '<br>');

        keywords.forEach(word => {
            const reg = new RegExp(escapeRegExp(word), 'g');
            html = html.replace(reg,
                `<span style="text-decoration: underline; text-decoration-color: ${config.textColor}; text-underline-offset: 3px;">${word}</span>`
            );
        });
        return html;
    }

    function showDonatePopup() {
        if (!DONATE_CONFIG.enable) return;
        if (GM_getValue(DONATE_CONFIG.storageKey, false)) return;

        const mask = document.createElement('div');
        mask.style.cssText = `
            position: fixed;
            left: 0; top: 0;
            width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5);
            z-index: 1000000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Microsoft YaHei, sans-serif;
        `;

        const popup = document.createElement('div');
        popup.style.cssText = `
            width: 420px;
            background: #fff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            animation: donateFadeIn 0.3s ease;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            height: 44px;
            line-height: 44px;
            padding: 0 16px;
            background: #409eff;
            color: #fff;
            font-size: 15px;
            font-weight: 500;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <span>${DONATE_CONFIG.title}</span>
            <span id="donateCloseBtn" style="cursor:pointer; font-size:20px; line-height:1;">×</span>
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            padding: 20px;
            text-align: center;
        `;
        content.innerHTML = `
            <p style="margin:0 0 16px 0; color:#666; font-size:14px;">${DONATE_CONFIG.desc}</p>
            <div style="display:flex; gap:20px; justify-content:center;">
                <div style="text-align:center;">
                    <img src="${DONATE_CONFIG.wechatQr}" style="width:150px; height:150px; border:1px solid #eee; border-radius:6px;" alt="微信收款码">
                    <p style="margin:8px 0 0 0; font-size:13px; color:#333;">${DONATE_CONFIG.wechatName}</p>
                </div>
                <div style="text-align:center;">
                    <img src="${DONATE_CONFIG.alipayQr}" style="width:150px; height:150px; border:1px solid #eee; border-radius:6px;" alt="支付宝收款码">
                    <p style="margin:8px 0 0 0; font-size:13px; color:#333;">${DONATE_CONFIG.alipayName}</p>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 0 20px 16px 20px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;
        footer.innerHTML = `
            <button id="donateNeverBtn" style="padding:6px 14px; border:1px solid #dcdfe6; background:#fff; color:#606266; border-radius:4px; cursor:pointer; font-size:13px;">不再提示</button>
            <button id="donateOkBtn" style="padding:6px 14px; border:none; background:#409eff; color:#fff; border-radius:4px; cursor:pointer; font-size:13px;">好的</button>
        `;

        popup.appendChild(header);
        popup.appendChild(content);
        popup.appendChild(footer);
        mask.appendChild(popup);
        document.body.appendChild(mask);

        GM_addStyle(`
            @keyframes donateFadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `);

        function closePopup() {
            mask.remove();
        }

        function neverShow() {
            GM_setValue(DONATE_CONFIG.storageKey, true);
            closePopup();
        }

        mask.querySelector('#donateCloseBtn').addEventListener('click', closePopup);
        mask.querySelector('#donateOkBtn').addEventListener('click', closePopup);
        mask.querySelector('#donateNeverBtn').addEventListener('click', neverShow);
        mask.addEventListener('click', (e) => {
            if (e.target === mask) closePopup();
        });
    }

    GM_addStyle(`
        #asrContent::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        #asrContent::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }
        #asrContent::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }
        #asrContent::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
    `);

    const panel = document.createElement('div');
    const dragHeader = document.createElement('div');
    const resizeHandle = document.createElement('div');
    const contentWrap = document.createElement('div');

    panel.style.cssText = `
        position: fixed;
        right: ${panelPos.right};
        top: ${panelPos.top};
        width: ${panelSize.width};
        height: ${panelSize.height};
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        user-select: none;
    `;

    dragHeader.style.cssText = `
        height: 32px;
        line-height: 32px;
        padding: 0 12px;
        background: #409eff;
        color: #fff;
        font-weight: 500;
        cursor: move;
        font-size: 14px;
        display: flex;
        align-items: center;
    `;
    dragHeader.innerText = PANEL_TITLE;

    contentWrap.id = 'asrContent';
    contentWrap.style.cssText = `
        flex: 1;
        padding: 10px 12px;
        overflow: auto;
        user-select: text;
        font-size: ${TEXT_STYLE.fontSize};
        color: ${TEXT_STYLE.color};
        line-height: ${TEXT_STYLE.lineHeight};
        font-family: ${TEXT_STYLE.fontFamily};
        word-break: break-all;
    `;
    contentWrap.innerText = '加载中...';

    resizeHandle.style.cssText = `
        position: absolute;
        right: 0;
        bottom: 0;
        width: 14px;
        height: 14px;
        background: linear-gradient(135deg, transparent 50%, #c1c1c1 50%);
        cursor: se-resize;
        border-top-left-radius: 4px;
    `;

    panel.appendChild(dragHeader);
    panel.appendChild(contentWrap);
    panel.appendChild(resizeHandle);
    document.body.appendChild(panel);

    dragHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        panelStartTop = parseInt(panel.style.top);
        panelStartRight = parseInt(panel.style.right);
        e.preventDefault();
    });

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        panelStartW = parseInt(panel.style.width);
        panelStartH = parseInt(panel.style.height);
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const offsetX = dragStartX - e.clientX;
            const offsetY = e.clientY - dragStartY;
            panel.style.right = `${panelStartRight + offsetX}px`;
            panel.style.top = `${panelStartTop + offsetY}px`;
        }
        if (isResizing) {
            const offsetX = e.clientX - resizeStartX;
            const offsetY = e.clientY - resizeStartY;
            panel.style.width = `${Math.max(200, panelStartW + offsetX)}px`;
            panel.style.height = `${Math.max(150, panelStartH + offsetY)}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            GM_setValue(STORAGE_KEY_POS, {
                right: panel.style.right,
                top: panel.style.top
            });
        }
        if (isResizing) {
            isResizing = false;
            GM_setValue(STORAGE_KEY_SIZE, {
                width: panel.style.width,
                height: panel.style.height
            });
        }
    });

    async function loadASR() {
        try {
            const url = new URL(location.href);
            const taskId = url.searchParams.get('taskId');
            const contentId = url.searchParams.get('contentId');
            const liveId = url.searchParams.get('liveId');

            if (!taskId || !contentId) {
                contentWrap.innerText = '参数缺失，无法请求数据';
                return;
            }

            const api = `/api/workbench/getTaskDetailData?opt_type=2&type=1&task_id=${taskId}&content_id=${contentId}&live_id=${liveId || ''}`;
            const response = await fetch(api);
            const data = await response.json();
            console.log('ASR返回', data);

            const asrText = data && data.content && data.content.asrDataList
                ? data.content.asrDataList.join('\n')
                : '未找到ASR数据';

            if (HIGHLIGHT_CONFIG.enable) {
                setTimeout(() => {
                    const titleText = getTitleText();
                    console.log('识别到的页面标题:', titleText);
                    const matchKeywords = getCommonSubstrings(titleText, asrText, HIGHLIGHT_CONFIG.minMatchLength);
                    console.log('匹配到的关键词:', matchKeywords);
                    
                    highlightTitle(matchKeywords, HIGHLIGHT_CONFIG);
                    contentWrap.innerHTML = highlightText(asrText, matchKeywords, HIGHLIGHT_CONFIG);
                }, 500);
            } else {
                contentWrap.innerText = preprocessText(asrText);
            }
        } catch (e) {
            console.error(e);
            contentWrap.innerText = `获取失败：${e.message}`;
        }
    }

    function watchUrlChange() {
        setInterval(() => {
            if (location.href !== oldUrl) {
                oldUrl = location.href;
                contentWrap.innerText = '页面切换，重新加载中...';
                setTimeout(loadASR, 300);
            }
        }, 800);
    }

    loadASR();
    watchUrlChange();
    window.addEventListener('load', () => {
        setTimeout(showDonatePopup, 1000);
    });
})();