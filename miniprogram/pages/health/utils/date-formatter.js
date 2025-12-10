/**
 * 日期格式化工具函数
 */

/**
 * 获取今天日期字符串
 * @returns {string} 格式: YYYY年MM月DD日
 */
export function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
}

/**
 * 格式化日期为相对时间
 * @param {string} dateStr - ISO日期字符串
 * @returns {string} 格式化后的时间描述
 */
export function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const recordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffDays = Math.floor((today - recordDate) / (1000 * 60 * 60 * 24))
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
 * 获取日期字符串(YYYY-MM-DD)
 * @param {Date} date - 日期对象
 * @returns {string}
 */
export function getDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取今天日期字符串(YYYY-MM-DD)
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
