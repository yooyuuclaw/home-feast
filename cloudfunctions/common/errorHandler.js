// cloudfunctions/common/errorHandler.js
/**
 * 统一的错误处理函数
 * 安全修复 #12: 避免向客户端返回详细的系统错误信息
 */

/**
 * 处理云函数错误，返回安全的错误响应
 * @param {Error} err - 错误对象
 * @param {string} userMessage - 用户友好的错误消息
 * @returns {object} 安全的错误响应
 */
function handleError(err, userMessage = '操作失败，请稍后重试') {
  // 记录完整错误到服务端日志（供调试使用）
  console.error('详细错误信息:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    errCode: err.errCode,
    errMsg: err.errMsg
  })

  // 只返回用户友好的消息和错误代码，不包含技术细节
  return {
    success: false,
    message: userMessage,
    errorCode: err.code || err.errCode || 'UNKNOWN_ERROR'
  }
}

/**
 * 根据错误类型返回对应的用户消息
 * @param {Error} err - 错误对象
 * @returns {object} 安全的错误响应
 */
function handleErrorWithType(err) {
  let userMessage = '操作失败，请稍后重试'

  // 根据错误类型提供更友好的提示
  if (err.errCode === -1 || (err.message && err.message.includes('database'))) {
    userMessage = '数据库连接失败，请稍后重试'
  } else if (err.message && err.message.includes('permission')) {
    userMessage = '权限不足'
  } else if (err.message && err.message.includes('network')) {
    userMessage = '网络错误，请检查网络连接'
  } else if (err.message && err.message.includes('timeout')) {
    userMessage = '操作超时，请重试'
  }

  return handleError(err, userMessage)
}

module.exports = {
  handleError,
  handleErrorWithType
}
