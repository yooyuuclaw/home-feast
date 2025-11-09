// cloudfunctions/audit/index.js
/**
 * 审计日志查询云函数
 * 仅管理员可访问
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloudbase-1gdysknn57ce9b9f'
})

const db = cloud.database()
const _ = db.command

/**
 * 检查是否为管理员
 */
async function checkAdmin(openid) {
  const res = await db.collection('users').where({
    _openid: openid
  }).get()

  if (res.data.length === 0) return false
  return res.data[0].role === 'admin'
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  try {
    // 权限检查
    const isAdmin = await checkAdmin(openid)
    if (!isAdmin) {
      return {
        success: false,
        message: '仅管理员可查看审计日志'
      }
    }

    switch (action) {
      case 'getLogs':
        return await getAuditLogs(event)
      case 'getLogsByUser':
        return await getLogsByUser(event)
      case 'getLogsByAction':
        return await getLogsByAction(event)
      case 'getStats':
        return await getAuditStats(event)
      default:
        return {
          success: false,
          message: '无效的操作'
        }
    }
  } catch (err) {
    console.error('审计日志查询失败', err)
    return {
      success: false,
      message: '查询失败',
      errorCode: err.code || 'UNKNOWN_ERROR'
    }
  }
}

/**
 * 获取审计日志列表
 * 参数：
 * - limit: 返回数量（默认20，最大100）
 * - offset: 跳过数量（用于分页）
 * - level: 日志级别过滤（info/warning/critical）
 * - startDate: 开始日期
 * - endDate: 结束日期
 */
async function getAuditLogs(event) {
  const { limit = 20, offset = 0, level, startDate, endDate } = event

  const maxLimit = Math.min(limit, 100)

  let query = db.collection('audit_logs')

  // 构建查询条件
  const where = {}

  if (level) {
    where.level = level
  }

  if (startDate || endDate) {
    where.timestamp = {}
    if (startDate) {
      where.timestamp[_.gte] = new Date(startDate)
    }
    if (endDate) {
      where.timestamp[_.lte] = new Date(endDate)
    }
  }

  if (Object.keys(where).length > 0) {
    query = query.where(where)
  }

  const res = await query
    .orderBy('timestamp', 'desc')
    .skip(offset)
    .limit(maxLimit)
    .get()

  // 统计总数
  const countRes = await db.collection('audit_logs').where(where).count()

  return {
    success: true,
    data: res.data,
    total: countRes.total,
    message: '获取成功'
  }
}

/**
 * 按用户查询审计日志
 */
async function getLogsByUser(event) {
  const { userId, limit = 20 } = event

  if (!userId) {
    return {
      success: false,
      message: '缺少用户ID'
    }
  }

  const res = await db.collection('audit_logs')
    .where({
      userId: userId
    })
    .orderBy('timestamp', 'desc')
    .limit(Math.min(limit, 100))
    .get()

  return {
    success: true,
    data: res.data,
    message: '获取成功'
  }
}

/**
 * 按操作类型查询审计日志
 */
async function getLogsByAction(event) {
  const { action, limit = 20 } = event

  if (!action) {
    return {
      success: false,
      message: '缺少操作类型'
    }
  }

  const res = await db.collection('audit_logs')
    .where({
      action: action
    })
    .orderBy('timestamp', 'desc')
    .limit(Math.min(limit, 100))
    .get()

  return {
    success: true,
    data: res.data,
    message: '获取成功'
  }
}

/**
 * 获取审计日志统计信息
 */
async function getAuditStats(event) {
  const { days = 7 } = event

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // 获取指定时间范围内的日志
  const res = await db.collection('audit_logs')
    .where({
      timestamp: _.gte(startDate)
    })
    .get()

  const logs = res.data

  // 统计各级别日志数量
  const stats = {
    total: logs.length,
    critical: logs.filter(log => log.level === 'critical').length,
    warning: logs.filter(log => log.level === 'warning').length,
    info: logs.filter(log => log.level === 'info').length,

    // 统计各操作类型
    actionStats: {},

    // 统计活跃用户
    activeUsers: new Set(logs.map(log => log.userId)).size,

    // 失败操作数量
    failedOperations: logs.filter(log => !log.success).length
  }

  // 统计各操作类型的数量
  logs.forEach(log => {
    if (!stats.actionStats[log.action]) {
      stats.actionStats[log.action] = 0
    }
    stats.actionStats[log.action]++
  })

  return {
    success: true,
    data: stats,
    message: '获取成功'
  }
}
