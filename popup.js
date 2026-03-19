// 获取翻译消息（使用 Chrome i18n API，会根据浏览器语言自动选择）
function getMessage(key, substitutions = []) {
  return chrome.i18n.getMessage(key, substitutions);
}

// 初始化 i18n
function initI18n() {
  // 更新界面文本
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = getMessage(key);
    if (message) {
      if (element.tagName === 'INPUT' && element.type === 'button') {
        element.value = message;
      } else {
        element.textContent = message;
      }
    }
  });
  // 更新 title
  document.title = getMessage('title');
}

// 页面加载时初始化 i18n
initI18n();

// 显示状态消息
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status show ${type}`;
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 5000);
}

// 获取当前活动标签页
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// 加载保存的设置
async function loadSettings() {
  const result = await chrome.storage.local.get({ keepRounds: 10, autoMaintain: false });
  document.getElementById('keepRounds').value = result.keepRounds;
  document.getElementById('autoMaintain').checked = result.autoMaintain;
}

// 保存设置
async function saveSettings() {
  const keepRounds = parseInt(document.getElementById('keepRounds').value);
  if (keepRounds < 1 || keepRounds > 100) {
    showStatus(getMessage('errorKeepRoundsRange'), 'error');
    return false;
  }
  const autoMaintain = document.getElementById('autoMaintain').checked;
  await chrome.storage.local.set({ keepRounds, autoMaintain });
  return true;
}

// 通知所有 ChatGPT 标签页更新自动保持设置
async function notifyAutoMaintainChange() {
  const keepRounds = parseInt(document.getElementById('keepRounds').value);
  const autoMaintain = document.getElementById('autoMaintain').checked;
  const tabs = await chrome.tabs.query({
    url: ['https://chat.openai.com/*', 'https://chatgpt.com/*']
  });
  for (const tab of tabs) {
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'setAutoMaintain',
        autoMaintain,
        keepRounds
      });
    } catch (e) {
      // tab 可能没有 content script
    }
  }
}

// 页面加载时恢复设置
loadSettings();

// 从 badge 读取当前轮数并显示在 popup 内
async function loadCurrentRounds() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const text = await chrome.action.getBadgeText({ tabId: tab.id });
    setCurrentRoundsDisplay(text);
  } catch (e) {
    // 非 ChatGPT 页面或 badge 为空时忽略
  }
}

function setCurrentRoundsDisplay(text) {
  const el = document.getElementById('currentRounds');
  if (!el) return;
  if (text) {
    el.textContent = text + ' ' + chrome.i18n.getMessage('roundsUnit');
  } else {
    el.textContent = '';
  }
}
loadCurrentRounds();

// 输入框改变时保存并通知
document.getElementById('keepRounds').addEventListener('change', async () => {
  if (await saveSettings()) {
    const autoMaintain = document.getElementById('autoMaintain').checked;
    if (autoMaintain) {
      await notifyAutoMaintainChange();
    }
  }
});

// 复选框改变时保存并通知
document.getElementById('autoMaintain').addEventListener('change', async () => {
  if (await saveSettings()) {
    const autoMaintain = document.getElementById('autoMaintain').checked;
    await notifyAutoMaintainChange();
    if (autoMaintain) {
      const keepRounds = parseInt(document.getElementById('keepRounds').value);
      showStatus(getMessage('autoMaintainEnabled', [keepRounds.toString()]), 'success');
    } else {
      showStatus(getMessage('autoMaintainDisabled'), 'info');
    }
  }
});

// 检查 content script 是否已加载
async function checkContentScript(tabId) {
  try {
    // 尝试发送一个测试消息
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch (error) {
    // Content script 未加载，需要用户刷新页面
    return false;
  }
}

// 清理历史对话
document.getElementById('removeOldRounds').addEventListener('click', async () => {
  try {
    const tab = await getCurrentTab();
    
    // 检查是否在 ChatGPT 页面
    if (!tab.url.includes('chat.openai.com') && !tab.url.includes('chatgpt.com')) {
      showStatus(getMessage('errorNotChatGPT'), 'error');
      return;
    }

    // 检查 content script 是否已加载
    const scriptReady = await checkContentScript(tab.id);
    if (!scriptReady) {
      showStatus(getMessage('errorScriptLoad') + ' Please refresh the ChatGPT page and try again.', 'error');
      return;
    }

    // 保存设置
    if (!(await saveSettings())) {
      return;
    }

    const keepRounds = parseInt(document.getElementById('keepRounds').value);

    // 向 content script 发送消息
    chrome.tabs.sendMessage(tab.id, { 
      action: 'removeOldRounds', 
      keepRounds
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus(getMessage('errorOperationFailed'), 'error');
        console.error('发送消息失败:', chrome.runtime.lastError);
        return;
      }
      if (response) {
        if (response.success) {
          showStatus(response.message || getMessage('successCleaned', [keepRounds.toString()]), 'success');
        } else {
          showStatus(response.message || getMessage('errorOperationFailedRetry'), 'error');
        }
      } else {
        showStatus(getMessage('errorOperationFailedRetry'), 'error');
      }
    });
  } catch (error) {
    showStatus(getMessage('errorOccurred') + error.message, 'error');
    console.error('清理历史对话错误:', error);
  }
});

// 监听 background 广播的 badge 更新，与图标 badge 保持同步
chrome.runtime.onMessage.addListener((message) => {
  if (message.action !== 'badgeUpdated') return;
  getCurrentTab().then(tab => {
    if (tab?.id === message.tabId) {
      setCurrentRoundsDisplay(message.rounds > 0 ? String(message.rounds) : '');
    }
  }).catch(() => {});
});

