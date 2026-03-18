// Content Script - 在 ChatGPT 页面中运行
// 用于清理历史对话轮次，只保留最近的 N 轮

// 获取翻译消息（使用 Chrome i18n API，会根据浏览器语言自动选择）
function getMessage(key, substitutions = []) {
  return chrome.i18n.getMessage(key, substitutions);
}

// 查找所有对话节点（兼容旧版 article 和新版 section turn）
function findTurnElements() {
  const thread = document.querySelector('#thread');
  if (!thread) {
    return [];
  }

  // 新版 ChatGPT 结构：section[data-testid^="conversation-turn-"]
  const turnSections = Array.from(
    thread.querySelectorAll('section[data-testid^="conversation-turn-"][data-turn-id]')
  );
  if (turnSections.length > 0) {
    return turnSections;
  }

  // 旧版结构回退：article
  return Array.from(thread.querySelectorAll('article'));
}

// 计算对话轮数（每2个节点 = 1轮）
function calculateRounds(turnElements) {
  return Math.floor(turnElements.length / 2);
}

// 清理历史对话轮次
// 简单方案：保留最后 2N 个 article，删除前面所有的
function removeOldRounds(keepRounds) {
  try {
    const turnElements = findTurnElements();

    if (turnElements.length === 0) {
      return {
        success: false,
        message: getMessage('errorNotFound')
      };
    }

    const totalTurns = turnElements.length;
    const turnsToKeep = keepRounds * 2;
    const turnsToRemove = totalTurns - turnsToKeep;

    if (turnsToRemove <= 0) {
      const currentRounds = Math.floor(totalTurns / 2);
      return {
        success: true,
        message: getMessage('infoNoNeedClean', [currentRounds.toString()]),
        rounds: currentRounds
      };
    }

    // 删除最旧的节点（保留最新）
    const turnElementsToDelete = turnElements.slice(0, turnsToRemove);
    turnElementsToDelete.forEach(turnEl => {
      if (turnEl.parentNode) {
        turnEl.remove();
      }
    });

    const removedRounds = Math.floor(turnsToRemove / 2);
    const remainingRounds = Math.floor(turnsToKeep / 2);

    return {
      success: true,
      message: getMessage('successCleanedDetailed', [removedRounds.toString(), remainingRounds.toString()]),
      rounds: remainingRounds
    };
  } catch (error) {
    console.error('清理历史对话时出错:', error);
    return {
      success: false,
      message: getMessage('errorCleanFailed') + error.message
    };
  }
}

// 检查当前对话轮数
function checkRounds() {
  try {
    const turnElements = findTurnElements();

    if (turnElements.length === 0) {
      return {
        success: false,
        message: getMessage('errorNoMessages'),
        rounds: 0
      };
    }

    const rounds = Math.floor(turnElements.length / 2);

    return {
      success: true,
      message: getMessage('infoCurrentRoundsDetailed', [rounds.toString(), turnElements.length.toString()]),
      rounds: rounds
    };
  } catch (error) {
    console.error('检查对话轮数时出错:', error);
    return {
      success: false,
      message: getMessage('errorCheckFailed') + error.message,
      rounds: 0
    };
  }
}

// ========== 自动保持轮数功能 ==========

let autoMaintainEnabled = false;
let autoMaintainKeepRounds = 10;
let observer = null;
// 防抖：避免短时间内多次触发清理
let cleanupTimer = null;

function scheduleAutoCleanup() {
  if (cleanupTimer) clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => {
    if (!autoMaintainEnabled) return;
    const turnElements = findTurnElements();
    const turnsToKeep = autoMaintainKeepRounds * 2;
    if (turnElements.length > turnsToKeep) {
      const turnElementsToDelete = turnElements.slice(0, turnElements.length - turnsToKeep);
      turnElementsToDelete.forEach(turnEl => {
        if (turnEl.parentNode) turnEl.remove();
      });
    }
  }, 500);
}

function startObserver() {
  if (observer) return;
  const target = document.documentElement || document.body;
  if (!target) return;

  observer = new MutationObserver((mutations) => {
    if (!autoMaintainEnabled) return;
    // 监听全局新增节点，兼容会话切换/新建会话导致的容器替换
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const isTurnSection =
            node.matches?.('section[data-testid^="conversation-turn-"][data-turn-id]') ||
            node.querySelector?.('section[data-testid^="conversation-turn-"][data-turn-id]');
          if (
            node.id === 'thread' ||
            node.tagName === 'ARTICLE' ||
            node.querySelector?.('#thread') ||
            node.querySelector?.('article') ||
            isTurnSection
          ) {
            scheduleAutoCleanup();
            return;
          }
        }
      }
    }
  });

  observer.observe(target, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
}

function updateAutoMaintain(enabled, keepRounds) {
  autoMaintainEnabled = enabled;
  autoMaintainKeepRounds = keepRounds;

  if (enabled) {
    startObserver();
    scheduleAutoCleanup();
  } else {
    stopObserver();
  }
}

// 页面加载时从存储中恢复自动保持设置
async function initAutoMaintain() {
  try {
    const result = await chrome.storage.local.get({ autoMaintain: false, keepRounds: 10 });
    updateAutoMaintain(result.autoMaintain, result.keepRounds);
  } catch (e) {
    // storage 访问失败时忽略
  }
}

// 监听存储变化（当用户在 popup 中改设置，但 popup 关闭后再打开新 tab 时也能同步）
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoMaintain || changes.keepRounds) {
    const enabled = changes.autoMaintain
      ? changes.autoMaintain.newValue
      : autoMaintainEnabled;
    const rounds = changes.keepRounds
      ? changes.keepRounds.newValue
      : autoMaintainKeepRounds;
    updateAutoMaintain(enabled, rounds);
  }
});

// ========== 消息监听 ==========

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 处理 ping 消息（用于检查 content script 是否已加载）
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'content script loaded' });
    return true;
  }
  
  // 处理自动保持设置
  if (request.action === 'setAutoMaintain') {
    updateAutoMaintain(request.autoMaintain, request.keepRounds);
    sendResponse({ success: true });
    return true;
  }

  // 处理其他消息
  try {
    if (request.action === 'removeOldRounds') {
      const result = removeOldRounds(request.keepRounds);
      sendResponse(result);
    } else if (request.action === 'checkRounds') {
      const result = checkRounds();
      sendResponse(result);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ 
      success: false, 
      message: getMessage('errorOccurred') + error.message 
    });
  }
  
  return true;
});

// ========== 初始化 ==========

// #thread 可能在 content script 加载后才出现，需要等待
function waitForThreadAndInit() {
  const thread = document.querySelector('#thread');
  if (thread) {
    initAutoMaintain();
    return;
  }
  // 用 MutationObserver 等待 #thread 出现
  const bodyObserver = new MutationObserver(() => {
    if (document.querySelector('#thread')) {
      bodyObserver.disconnect();
      initAutoMaintain();
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForThreadAndInit);
} else {
  waitForThreadAndInit();
}
