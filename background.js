// Background Service Worker

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log(chrome.i18n.getMessage('installed'));
    
    // 设置默认配置
    chrome.storage.local.set({
      enabled: true,
      autoRemove: false
    });
  } else if (details.reason === 'update') {
    console.log(chrome.i18n.getMessage('updated'));
  }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 如果是在 ChatGPT 页面，可以执行一些初始化操作
    if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) {
      console.log(chrome.i18n.getMessage('detectedChatGPT'));
    }
  }
});

// 处理来自 content script 或 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

