/**
 * 数据计算统计工具函数
 */

import { getDateString } from './date-formatter.js'

/**
 * 计算本周统计数据(最近7天)
 * @param {Array} records - 记录列表
 * @param {number} goalAmount - 目标量
 * @returns {Object} 包含totalAmount, avgAmount, completeDays
 */
export function calculateWeeklyStats(records, goalAmount) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 创建最近7天的日期映射
  const dailyAmounts = {}
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = getDateString(date)
    dailyAmounts[dateStr] = 0
  }

  // 统计每天的饮水量
  records.forEach(record => {
    const dateStr = record.date.substring(0, 10)
    if (dailyAmounts.hasOwnProperty(dateStr)) {
      dailyAmounts[dateStr] += record.amount
    }
  })

  // 计算总量、平均量和达标天数
  const amounts = Object.values(dailyAmounts)
  const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0)
  const avgAmount = Math.round(totalAmount / 7)
  const completeDays = amounts.filter(amount => amount >= goalAmount).length

  return {
    totalAmount,
    avgAmount,
    completeDays
  }
}

/**
 * 计算连续打卡天数(从今天往前推)
 * @param {Array} records - 记录列表
 * @param {number} goalAmount - 目标量
 * @returns {number} 连续打卡天数
 */
export function calculateStreakDays(records, goalAmount) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 按日期分组统计每天的饮水量
  const dailyAmounts = {}
  records.forEach(record => {
    const dateStr = record.date.substring(0, 10)
    if (!dailyAmounts[dateStr]) {
      dailyAmounts[dateStr] = 0
    }
    dailyAmounts[dateStr] += record.amount
  })

  // 从今天开始往前检查连续打卡
  let streakDays = 0
  let checkDate = new Date(today)

  while (true) {
    const dateStr = getDateString(checkDate)

    if (dailyAmounts[dateStr] && dailyAmounts[dateStr] >= goalAmount) {
      streakDays++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      // 如果检查的是今天且未达标，继续检查昨天
      if (streakDays === 0 && checkDate.getTime() === today.getTime()) {
        checkDate.setDate(checkDate.getDate() - 1)
        continue
      }
      break
    }
  }

  return streakDays
}

/**
 * 处理健康记录数据，统计各类型数量和最新值
 * @param {Array} records - 健康记录列表
 * @returns {Object} 包含counts和latestData
 */
export function processHealthRecords(records) {
  const counts = {
    weight: 0,
    bloodPressure: 0,
    bloodSugar: 0,
    bloodOxygen: 0,
    uricAcid: 0,
    height: 0
  }

  const latestData = {
    weight: '',
    bloodPressure: '',
    bloodSugar: '',
    bloodOxygen: '',
    uricAcid: '',
    height: ''
  }

  // 按类型分组，获取最新值
  const typeLatest = {}
  records.forEach(record => {
    counts[record.type]++
    if (!typeLatest[record.type]) {
      typeLatest[record.type] = record
    }
  })

  // 填充最新数据
  Object.keys(typeLatest).forEach(type => {
    const record = typeLatest[type]
    latestData[type] = record.displayValue
  })

  return { counts, latestData }
}
