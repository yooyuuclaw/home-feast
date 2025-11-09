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
    // 权限检查（部分操作需要管理员权限）
    const needsAdmin = ['getLogs', 'getLogsByUser', 'getLogsByAction', 'getStats', 'cleanOldLogs']

    if (needsAdmin.includes(action)) {
      const isAdmin = await checkAdmin(openid)
      if (!isAdmin) {
        return {
          success: false,
          message: '仅管理员可查看审计日志'
        }
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
      case 'cleanOldLogs':
        return await cleanOldLogs(event)
      case 'sendAlert':
        return await sendAlert(event)
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

/**
 * 清理超过指定天数的旧日志
 * 参数：
 * - days: 保留天数（默认90天）
 */
async function cleanOldLogs(event) {
  const { days = 90 } = event

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  try {
    // 查询要删除的日志数量
    const countRes = await db.collection('audit_logs')
      .where({
        timestamp: _.lt(cutoffDate)
      })
      .count()

    const oldLogsCount = countRes.total

    if (oldLogsCount === 0) {
      return {
        success: true,
        deleted: 0,
        message: '没有需要清理的旧日志'
      }
    }

    // 批量删除旧日志（每次最多删除20条）
    const MAX_LIMIT = 20
    let deletedCount = 0

    while (deletedCount < oldLogsCount) {
      const res = await db.collection('audit_logs')
        .where({
          timestamp: _.lt(cutoffDate)
        })
        .limit(MAX_LIMIT)
        .get()

      if (res.data.length === 0) break

      // 删除这批记录
      const removePromises = res.data.map(log =>
        db.collection('audit_logs').doc(log._id).remove()
      )

      await Promise.all(removePromises)
      deletedCount += res.data.length
    }

    console.log(`审计日志清理完成，删除了 ${deletedCount} 条超过 ${days} 天的日志`)

    return {
      success: true,
      deleted: deletedCount,
      message: `成功清理 ${deletedCount} 条旧日志`
    }
  } catch (err) {
    console.error('清理日志失败', err)
    return {
      success: false,
      message: '清理失败',
      error: err.message
    }
  }
}

/**
 * 发送告警通知
 * 参数：
 * - log: 审计日志对象
 * - alertType: 告警类型（critical_fail, permission_denied, etc.）
 */
async function sendAlert(event) {
  const { log, alertType } = event

  if (!log) {
    return {
      success: false,
      message: '缺少日志信息'
    }
  }

  try {
    // 获取所有管理员
    const adminsRes = await db.collection('users')
      .where({
        role: 'admin'
      })
      .get()

    const admins = adminsRes.data

    if (admins.length === 0) {
      return {
        success: false,
        message: '没有管理员可以接收告警'
      }
    }

    // 构建告警消息
    let alertMessage = ''
    let alertLevel = '提示'

    switch (alertType) {
      case 'critical_fail':
        alertLevel = '严重'
        alertMessage = `关键操作失败：${log.actionName || log.action}\n`
        alertMessage += `操作用户：${log.userId}\n`
        alertMessage += `失败原因：${log.message}\n`
        alertMessage += `时间：${new Date(log.timestamp).toLocaleString('zh-CN')}`
        break

      case 'permission_denied':
        alertLevel = '警告'
        alertMessage = `检测到未授权访问尝试\n`
        alertMessage += `尝试操作：${log.actionName || log.action}\n`
        alertMessage += `用户：${log.userId}\n`
        alertMessage += `时间：${new Date(log.timestamp).toLocaleString('zh-CN')}`
        break

      case 'multiple_failures':
        alertLevel = '警告'
        alertMessage = `检测到多次操作失败\n`
        alertMessage += `详情请查看审计日志`
        break

      default:
        alertMessage = `审计告警：${log.message}`
    }

    // 记录告警到数据库
    await db.collection('alerts').add({
      data: {
        type: alertType,
        level: alertLevel,
        message: alertMessage,
        logId: log._id || '',
        targetAdmins: admins.map(admin => admin._id),
        read: false,
        createTime: db.serverDate()
      }
    })

    // 这里可以扩展：发送模板消息、短信、邮件等
    // 由于微信小程序的限制，目前只记录到数据库
    // 管理员登录时可以查看未读告警

    console.log(`[告警] ${alertLevel}: ${alertMessage}`)

    return {
      success: true,
      message: '告警已记录',
      alertLevel,
      notifiedAdmins: admins.length
    }
  } catch (err) {
    console.error('发送告警失败', err)
    return {
      success: false,
      message: '告警失败',
      error: err.message
    }
  }
}
