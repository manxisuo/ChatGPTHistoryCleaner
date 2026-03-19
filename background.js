// Background Service Worker

const CHATGPT_HOSTS = ['chat.openai.com', 'chatgpt.com'];

function isChatGPTUrl(url) {
  if (!url) return false;
  return CHATGPT_HOSTS.some(host => url.includes(host));
}

function setBadge(tabId, rounds) {
  const text = rounds > 0 ? (rounds > 999 ? '999+' : String(rounds)) : '';
  chrome.action.setBadgeText({ text, tabId });
  if (text) {
    chrome.action.setBadgeBackgroundColor({ color: '#667eea', tabId });
    chrome.action.setTitle({
      title: chrome.i18n.getMessage('badgeTitle', [String(rounds)]),
      tabId
    });
  } else {
    chrome.action.setTitle({
      title: chrome.i18n.getMessage('extensionName'),
      tabId
    });
  }
  // 通知 popup（若已打开）同步更新轮数显示
  chrome.runtime.sendMessage({ action: 'badgeUpdated', rounds, tabId }).catch(() => {});
}

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 设置默认配置
    chrome.storage.local.set({
      enabled: true,
      autoRemove: false
    });
  }
});

// 切换到非 ChatGPT 标签时清除 badge
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!isChatGPTUrl(tab.url)) {
      chrome.action.setBadgeText({ text: '', tabId: activeInfo.tabId });
    }
  } catch (e) {
    // 标签可能已关闭
  }
});

// 处理来自 content script 或 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge') {
    const tabId = sender.tab?.id;
    if (tabId != null) {
      setBadge(tabId, request.rounds ?? 0);
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getStorage') {
    chrome.storage.local.get(request.keys, (result) => {
      sendResponse(result);
    });
    return true;
  } else if (request.action === 'setStorage') {
    chrome.storage.local.set(request.data, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

