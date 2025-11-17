// cloudfunctions/user-activity/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloudbase-1gdysknn57ce9b9f'
})

const db = cloud.database()

/**
 * 用户活动记录云函数
 * 支持操作：recordSession（记录会话）、getStatistics（获取统计数据）
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  try {
    switch (action) {
      case 'recordSession':
        return await recordSession(event, openid)
      case 'getStatistics':
        return await getStatistics(event, openid)
      default:
        return {
          success: false,
          message: '无效的操作'
        }
    }
  } catch (err) {
    console.error('用户活动操作失败', err)
    return {
      success: false,
      message: '操作失败',
      error: err
    }
  }
}

/**
 * 记录用户会话
 * 参数：duration（在线时长，单位：秒）
 */
async function recordSession(event, openid) {
  const { duration } = event

  if (!duration || duration <= 0) {
    return {
      success: false,
      message: '无效的在线时长'
    }
  }

  // 记录会话到 user_sessions 集合
  await db.collection('user_sessions').add({
    data: {
      _openid: openid,
      duration: duration, // 在线时长（秒）
      sessionTime: db.serverDate(), // 会话时间
      createTime: db.serverDate()
    }
  })

  return {
    success: true,
    message: '会话记录成功'
  }
}

/**
 * 获取用户活动统计
 */
async function getStatistics(event, openid) {
  // 检查是否为管理员
  const userRes = await db.collection('users').where({
    _openid: openid
  }).get()

  if (userRes.data.length === 0 || userRes.data[0].role !== 'admin') {
    return {
      success: false,
      message: '无权限访问'
    }
  }

  // 获取所有用户信息
  const usersRes = await db.collection('users').get()
  const users = usersRes.data

  // 获取所有会话记录（分批获取，因为单次 get() 最多返回100条）
  let sessions = []
  const MAX_LIMIT = 100
  let hasMore = true
  let lastId = null

  while (hasMore) {
    let query = db.collection('user_sessions').limit(MAX_LIMIT).orderBy('_id', 'asc')

    if (lastId) {
      query = query.where({
        _id: db.command.gt(lastId)
      })
    }

    const sessionsRes = await query.get()
    sessions = sessions.concat(sessionsRes.data)

    if (sessionsRes.data.length < MAX_LIMIT) {
      hasMore = false
    } else {
      lastId = sessionsRes.data[sessionsRes.data.length - 1]._id
    }
  }

  console.log('获取到的会话记录总数:', sessions.length)

  // 为每个用户计算统计数据
  const statistics = users.map(user => {
    // 过滤该用户的会话
    const userSessions = sessions.filter(s => s._openid === user._openid)

    // 计算总在线时长（秒）
    const totalDuration = userSessions.reduce((sum, s) => sum + s.duration, 0)

    // 会话次数
    const sessionCount = userSessions.length

    // 平均在线时长（秒）
    const avgDuration = sessionCount > 0 ? Math.floor(totalDuration / sessionCount) : 0

    // 处理时间字段 - 将服务端时间对象转换为时间戳
    let createTime = null
    let lastOnlineTime = null

    if (user.createTime) {
      if (user.createTime.$date) {
        createTime = new Date(user.createTime.$date).getTime()
      } else if (typeof user.createTime === 'object' && user.createTime instanceof Date) {
        createTime = user.createTime.getTime()
      } else {
        createTime = new Date(user.createTime).getTime()
      }
    }

    if (user.lastOnlineTime) {
      if (user.lastOnlineTime.$date) {
        lastOnlineTime = new Date(user.lastOnlineTime.$date).getTime()
      } else if (typeof user.lastOnlineTime === 'object' && user.lastOnlineTime instanceof Date) {
        lastOnlineTime = user.lastOnlineTime.getTime()
      } else {
        lastOnlineTime = new Date(user.lastOnlineTime).getTime()
      }
    } else {
      lastOnlineTime = createTime // 如果没有 lastOnlineTime，使用 createTime
    }

    return {
      _id: user._id,
      // _openid 已移除 - 安全修复：不应暴露用户的 openid
      nickname: user.nickname || '微信用户',
      avatar: user.avatar || '',
      role: user.role,
      createTime: createTime, // 首次上线时间（时间戳）
      lastOnlineTime: lastOnlineTime, // 最后上线时间（时间戳）
      sessionCount: sessionCount, // 会话次数
      totalDuration: totalDuration, // 总在线时长（秒）
      avgDuration: avgDuration // 平均在线时长（秒）
    }
  })

  // 按最后上线时间倒序排序
  statistics.sort((a, b) => {
    const timeA = a.lastOnlineTime || a.createTime || 0
    const timeB = b.lastOnlineTime || b.createTime || 0
    return timeB - timeA
  })

  return {
    success: true,
    data: statistics,
    message: '获取统计数据成功'
  }
}
