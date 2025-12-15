// Content Script - 在 ChatGPT 页面中运行
// 用于清理历史对话轮次，只保留最近的 N 轮

// 查找所有 article 元素（不管角色，都认为是有效的对话）
function findArticleElements() {
  // 优先使用 #thread article 选择器（根据用户提供的路径信息）
  const thread = document.querySelector('#thread');
  if (!thread) {
    console.warn('未找到 #thread 容器');
    return [];
  }
  
  // 查找 thread 下的所有 article 元素
  const articles = Array.from(thread.querySelectorAll('article'));
  
  if (articles.length === 0) {
    console.warn('未找到 article 元素');
    return [];
  }
  
  console.log(`找到 ${articles.length} 个 article`);
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
        message: '未找到对话消息，请确保在 ChatGPT 对话页面'
      };
    }
    
    const totalArticles = articles.length;
    const articlesToKeep = keepRounds * 2; // 保留 N 轮 = 保留最后 2N 个 article
    const articlesToRemove = totalArticles - articlesToKeep;
    
    if (articlesToRemove <= 0) {
      const currentRounds = Math.floor(totalArticles / 2);
      return {
        success: true,
        message: `当前只有 ${currentRounds} 轮对话，无需清理`,
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
    
    console.log(`删除统计：总article数=${totalArticles}, 删除=${articlesToRemove}个, 保留=${articlesToKeep}个, 删除轮数=${removedRounds}, 保留轮数=${remainingRounds}`);
    
    return {
      success: true,
      message: `已清理 ${removedRounds} 轮历史对话，保留最近 ${remainingRounds} 轮`,
      rounds: remainingRounds
    };
  } catch (error) {
    console.error('清理历史对话时出错:', error);
    return {
      success: false,
      message: '清理失败：' + error.message
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
        message: '未找到对话消息',
        rounds: 0
      };
    }
    
    // 每2个article = 1轮对话
    const rounds = Math.floor(articles.length / 2);
    
    return {
      success: true,
      message: `当前共有 ${rounds} 轮对话（${articles.length} 个 article）`,
      rounds: rounds
    };
  } catch (error) {
    console.error('检查对话轮数时出错:', error);
    return {
      success: false,
      message: '检查失败：' + error.message,
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
  
  if (request.action === 'removeOldRounds') {
    const result = removeOldRounds(request.keepRounds);
    sendResponse(result);
    return true;
  } else if (request.action === 'checkRounds') {
    const result = checkRounds();
    sendResponse(result);
    return true;
  }
  
  return true; // 保持消息通道开放以支持异步响应
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('ChatGPT History Cleaner content script loaded');
  });
} else {
    console.log('ChatGPT History Cleaner content script loaded');
}
