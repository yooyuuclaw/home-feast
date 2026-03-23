/**
 * 日期格式化工具函数
 */

/**
 * 安全地解析日期字符串，兼容iOS
 * iOS Safari不支持带空格的日期格式，需要使用ISO 8601标准格式（带T的格式）
 * @param {string|Date|number} dateStr - 日期字符串、日期对象或时间戳
 * @returns {Date} 日期对象
 * @example
 * parseDateSafe('2025-12-11T10:34:00') // iOS兼容
 * parseDateSafe(new Date())
 * parseDateSafe(1702281240000)
 */
export function parseDateSafe(dateStr) {
  // 如果已经是 Date 对象，直接返回
  if (dateStr instanceof Date) {
    return dateStr
  }

  // 如果是数字（时间戳），直接创建 Date
  if (typeof dateStr === 'number') {
    return new Date(dateStr)
  }

  // 如果是字符串，处理兼容性问题
  if (typeof dateStr === 'string') {
    // 替换空格为 T，使其符合 ISO 8601 格式，兼容 iOS
    const isoStr = dateStr.replace(' ', 'T')
    return new Date(isoStr)
  }

  // 其他情况，尝试直接创建
  return new Date(dateStr)
}

/**
 * 获取今天日期字符串（东八区时间）
 * @returns {string} 格式: YYYY年MM月DD日
 */
export function getTodayDateString() {
  const now = new Date()
  // 转换为东八区时间（北京时间）
  const offset = 8 * 60 // 东八区偏移量（分钟）
  const localTime = new Date(now.getTime() + offset * 60 * 1000)

  const year = localTime.getUTCFullYear()
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localTime.getUTCDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
}

/**
 * 格式化日期为相对时间
 * @param {string} dateStr - ISO日期字符串
 * @returns {string} 格式化后的时间描述
 */
export function formatRelativeDate(dateStr) {
  const date = parseDateSafe(dateStr)
  const now = new Date()

  // 使用时间戳方式创建日期，避免 iOS 兼容性问题
  const todayTimestamp = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const recordTimestamp = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())

  const diffDays = Math.floor((todayTimestamp - recordTimestamp) / (1000 * 60 * 60 * 24))
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  if (diffDays === 0) {
    return `今天 ${hours}:${minutes}`
  } else if (diffDays === 1) {
    return `昨天 ${hours}:${minutes}`
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }
}

/**
 * 获取日期字符串(YYYY-MM-DD)，使用东八区时间
 * @param {Date} date - 日期对象
 * @returns {string}
 */
export function getDateString(date) {
  // 转换为东八区时间（北京时间）
  const offset = 8 * 60 // 东八区偏移量（分钟）
  const localTime = new Date(date.getTime() + offset * 60 * 1000)

  const year = localTime.getUTCFullYear()
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localTime.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取今天日期字符串(YYYY-MM-DD)，使用东八区时间
 * @returns {string}
 */
export function getTodayString() {
  return getDateString(new Date())
}

/**
 * 筛选今日记录
 * @param {Array} records - 记录列表
 * @returns {Array}
 */
export function filterTodayRecords(records) {
  const todayStr = getTodayString()
  return records
    .filter(record => record.date.startsWith(todayStr))
    .map(record => ({
      ...record,
      time: record.date.substring(11, 16) // 提取时间部分
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}
