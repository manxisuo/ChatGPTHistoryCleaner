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
  const result = await chrome.storage.local.get({ keepRounds: 10 });
  const keepRoundsInput = document.getElementById('keepRounds');
  keepRoundsInput.value = result.keepRounds;
}

// 保存设置
async function saveSettings() {
  const keepRounds = parseInt(document.getElementById('keepRounds').value);
  if (keepRounds < 1 || keepRounds > 100) {
    showStatus('保留轮数必须在 1-100 之间', 'error');
    return false;
  }
  await chrome.storage.local.set({ keepRounds });
  return true;
}

// 页面加载时恢复设置
loadSettings();

// 保存设置按钮（当输入框改变时自动保存）
document.getElementById('keepRounds').addEventListener('change', async () => {
  await saveSettings();
});

// 确保 content script 已注入
async function ensureContentScript(tabId) {
  try {
    // 尝试发送一个测试消息
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch (error) {
    // 如果失败，尝试注入 content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      // 等待一小段时间让脚本加载
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (injectError) {
      console.error('无法注入 content script:', injectError);
      return false;
    }
  }
}

// 清理历史对话
document.getElementById('removeOldRounds').addEventListener('click', async () => {
  try {
    const tab = await getCurrentTab();
    
    // 检查是否在 ChatGPT 页面
    if (!tab.url.includes('chat.openai.com') && !tab.url.includes('chatgpt.com')) {
      showStatus('请在 ChatGPT 页面使用此功能', 'error');
      return;
    }

    // 确保 content script 已注入
    const scriptReady = await ensureContentScript(tab.id);
    if (!scriptReady) {
      showStatus('无法加载扩展脚本，请刷新页面后重试', 'error');
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
        showStatus('操作失败：请刷新页面后重试', 'error');
        console.error('发送消息失败:', chrome.runtime.lastError);
      } else if (response && response.success) {
        showStatus(response.message || `已清理历史对话，保留最近 ${keepRounds} 轮`, 'success');
      } else {
        showStatus(response?.message || '操作失败，请刷新页面后重试', 'error');
      }
    });
  } catch (error) {
    showStatus('发生错误：' + error.message, 'error');
    console.error('清理历史对话错误:', error);
  }
});

// 查看当前对话数
document.getElementById('checkRounds').addEventListener('click', async () => {
  try {
    const tab = await getCurrentTab();
    
    if (!tab.url.includes('chat.openai.com') && !tab.url.includes('chatgpt.com')) {
      showStatus('请在 ChatGPT 页面使用此功能', 'error');
      return;
    }

    // 确保 content script 已注入
    const scriptReady = await ensureContentScript(tab.id);
    if (!scriptReady) {
      showStatus('无法加载扩展脚本，请刷新页面后重试', 'error');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'checkRounds' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('操作失败：请刷新页面后重试', 'error');
        console.error('发送消息失败:', chrome.runtime.lastError);
      } else if (response && response.success) {
        showStatus(`当前共有 ${response.rounds} 轮对话`, 'info');
      } else {
        showStatus(response?.message || '无法获取对话数', 'error');
      }
    });
  } catch (error) {
    showStatus('发生错误：' + error.message, 'error');
    console.error('查看对话数错误:', error);
  }
});
