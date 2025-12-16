// Content Script - 在 ChatGPT 页面中运行
// 用于清理历史对话轮次，只保留最近的 N 轮

// 获取翻译消息（使用 Chrome i18n API，会根据浏览器语言自动选择）
function getMessage(key, substitutions = []) {
  return chrome.i18n.getMessage(key, substitutions);
}

// 查找所有 article 元素（不管角色，都认为是有效的对话）
function findArticleElements() {
  // 优先使用 #thread article 选择器（根据用户提供的路径信息）
  const thread = document.querySelector('#thread');
  if (!thread) {
    return [];
  }
  
  // 查找 thread 下的所有 article 元素
  const articles = Array.from(thread.querySelectorAll('article'));
  
  if (articles.length === 0) {
    return [];
  }
  
  return articles;
}

// 计算对话轮数（每2个article = 1轮）
function calculateRounds(articles) {
  return Math.floor(articles.length / 2);
}

// 清理历史对话轮次
// 简单方案：保留最后 2N 个 article，删除前面所有的
function removeOldRounds(keepRounds) {
  try {
    // 查找所有 article 元素
    const articles = findArticleElements();
    
    if (articles.length === 0) {
      return {
        success: false,
        message: getMessage('errorNotFound')
      };
    }
    
    const totalArticles = articles.length;
    const articlesToKeep = keepRounds * 2; // 保留 N 轮 = 保留最后 2N 个 article
    const articlesToRemove = totalArticles - articlesToKeep;
    
    if (articlesToRemove <= 0) {
      const currentRounds = Math.floor(totalArticles / 2);
      return {
        success: true,
        message: getMessage('infoNoNeedClean', [currentRounds.toString()]),
        rounds: currentRounds
      };
    }
    
    // 删除前面的 article（保留后面的）
    // 使用数组副本，避免删除时影响索引
    const articlesToDelete = articles.slice(0, articlesToRemove);
    articlesToDelete.forEach(article => {
      if (article.parentNode) {
        article.remove();
      }
    });
    
    const removedRounds = Math.floor(articlesToRemove / 2);
    const remainingRounds = Math.floor(articlesToKeep / 2);
    
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
    const articles = findArticleElements();
    
    if (articles.length === 0) {
      return {
        success: false,
        message: getMessage('errorNoMessages'),
        rounds: 0
      };
    }
    
    // 每2个article = 1轮对话
    const rounds = Math.floor(articles.length / 2);
    
    return {
      success: true,
      message: getMessage('infoCurrentRoundsDetailed', [rounds.toString(), articles.length.toString()]),
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

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 处理 ping 消息（用于检查 content script 是否已加载）
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'content script loaded' });
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
  
  return true; // 保持消息通道开放以支持异步响应
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Content script loaded
  });
} else {
  // Content script loaded
}
