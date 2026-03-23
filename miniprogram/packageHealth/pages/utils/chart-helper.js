/**
 * 图表数据处理工具类
 */

/**
 * 处理健康记录数据为图表格式
 * @param {Array} records 健康记录数组
 * @param {String} type 健康指标类型
 * @param {Number} days 显示天数
 * @returns {Array} 图表数据 [{date: '2024-01-01', value: 65.5}, ...]
 */
export function processHealthChartData(records, type, days = 7) {
  console.log('[chart-helper] 处理图表数据, type:', type, 'days:', days)
  console.log('[chart-helper] 总记录数:', records ? records.length : 0)

  if (!records || records.length === 0) {
    console.log('[chart-helper] 没有记录数据')
    return []
  }

  // 打印所有记录的类型，用于调试
  const recordTypes = records.map(r => r.type)
  console.log('[chart-helper] 记录类型分布:', recordTypes)

  // 筛选指定类型的记录
  const filteredRecords = records.filter(r => r.type === type)
  console.log('[chart-helper] 筛选出的', type, '记录数:', filteredRecords.length)

  if (filteredRecords.length === 0) {
    console.log('[chart-helper] 没有找到类型为', type, '的记录')
    return []
  }

  // 修复日期格式，兼容 iOS
  // iOS 不支持带空格的日期格式，需要使用ISO 8601标准格式（带T的格式）
  const fixDateFormat = (dateStr) => {
    if (!dateStr) return new Date()
    // 将空格替换为 T，符合 ISO 8601 格式
    return new Date(dateStr.replace(' ', 'T'))
  }

  // 按日期排序
  filteredRecords.sort((a, b) => {
    return fixDateFormat(a.recordDate) - fixDateFormat(b.recordDate)
  })

  // 获取最近N天的数据
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  console.log('[chart-helper] 筛选日期范围:', startDate.toISOString(), '到', now.toISOString())

  const recentRecords = filteredRecords.filter(r => {
    return fixDateFormat(r.recordDate) >= startDate
  })

  console.log('[chart-helper] 最近', days, '天的记录数:', recentRecords.length)

  if (recentRecords.length === 0) {
    console.log('[chart-helper] 最近', days, '天没有数据')
    return []
  }

  // 处理血压数据 - 取收缩压
  const processValue = (record) => {
    if (type === 'bloodPressure' && record.extra && record.extra.systolic) {
      return parseFloat(record.extra.systolic)
    }
    return parseFloat(record.value)
  }

  // 按日期分组，每天取最新的一条
  const groupedByDate = {}
  recentRecords.forEach(record => {
    const date = record.recordDate.split(' ')[0] // 只取日期部分
    if (!groupedByDate[date] || fixDateFormat(record.recordDate) > fixDateFormat(groupedByDate[date].recordDate)) {
      groupedByDate[date] = record
    }
  })

  // 转换为图表数据格式
  const chartData = Object.keys(groupedByDate).map(date => ({
    date,
    value: processValue(groupedByDate[date])
  }))

  // 按日期排序（日期格式已经是 YYYY-MM-DD，可以直接字符串比较）
  chartData.sort((a, b) => a.date.localeCompare(b.date))

  console.log('[chart-helper] 最终图表数据:', chartData)

  return chartData
}

/**
 * 获取图表配置选项
 * @returns {Array} 图表类型选项
 */
export function getChartTypeOptions() {
  return [
    {
      type: 'height',
      label: '身高',
      unit: 'cm',
      color: '#30cfd0'
    },
    {
      type: 'weight',
      label: '体重',
      unit: 'kg',
      color: '#667eea'
    },
    {
      type: 'bloodPressure',
      label: '血压(收缩压)',
      unit: 'mmHg',
      color: '#f093fb'
    },
    {
      type: 'bloodOxygen',
      label: '血氧',
      unit: '%',
      color: '#43e97b'
    },
    {
      type: 'bloodSugar',
      label: '血糖',
      unit: 'mmol/L',
      color: '#4facfe'
    },
    {
      type: 'uricAcid',
      label: '尿酸',
      unit: 'μmol/L',
      color: '#fa709a'
    }
  ]
}

/**
 * 计算健康数据的统计信息
 * @param {Array} chartData 图表数据
 * @returns {Object} 统计信息
 */
export function calculateHealthStats(chartData) {
  if (!chartData || chartData.length === 0) {
    return {
      max: 0,
      min: 0,
      avg: 0,
      trend: 'stable' // up, down, stable
    }
  }

  const values = chartData.map(d => d.value)
  const max = Math.max.apply(null, values)
  const min = Math.min.apply(null, values)
  const avg = (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)

  // 计算趋势（最近3条数据的平均值 vs 整体平均值）
  let trend = 'stable'
  if (chartData.length >= 3) {
    const recentAvg = values.slice(-3).reduce((sum, v) => sum + v, 0) / 3
    if (recentAvg > avg * 1.02) trend = 'up'
    else if (recentAvg < avg * 0.98) trend = 'down'
  }

  return { max, min, avg: parseFloat(avg), trend }
}
