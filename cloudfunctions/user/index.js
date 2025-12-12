// cloudfunctions/user/index.js
const cloud = require('wx-server-sdk')
const { isValidRole } = require('./constants.js')
const { logUserRoleUpdate, logPermissionDenied } = require('./auditLogger.js')

cloud.init({
  env: 'cloudbase-1gdysknn57ce9b9f'
})

const db = cloud.database()

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

/**
 * 用户管理云函数
 * 支持操作：getAllUsers, list, getUserInfo, updateRole
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  try {
    switch (action) {
      case 'getAllUsers':
        return await getAllUsers(openid, {
          page: event.page,
          pageSize: event.pageSize,
          sortBy: event.sortBy
        })
      case 'list':
        return await getAllUsers(openid, {
          page: event.page,
          pageSize: event.pageSize,
          sortBy: event.sortBy
        }) // list 和 getAllUsers 是同一个功能
      case 'getUserInfo':
        return await getUserInfo(openid)
      case 'updateRole':
        return await updateUserRole(event, openid)
      default:
        return {
          success: false,
          message: '无效的操作'
        }
    }
  } catch (err) {
    console.error('用户操作失败', err)
    // 安全修复 #12: 不返回详细错误信息，避免泄露系统信息
    return {
      success: false,
      message: '操作失败，请稍后重试',
      errorCode: err.code || err.errCode || 'UNKNOWN_ERROR'
    }
  }
}

/**
 * 获取所有用户（需要管理员权限）
 * 支持分页参数：page（页码，从1开始）, pageSize（每页条数，默认100）
 * 支持排序参数：sortBy（排序字段：firstOnlineTime, lastOnlineTime, visitCount, totalDuration, avgDuration）
 */
async function getAllUsers(openid, options = {}) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const page = options.page || 1
  const pageSize = options.pageSize || 100
  const sortBy = options.sortBy || 'visitCount'

  console.log('[getAllUsers] 接收到的参数:', { page, pageSize, sortBy })

  // 获取总数
  const countRes = await db.collection('users').count()
  const total = countRes.total

  // 获取所有用户（不分页，因为需要与统计数据合并后排序）
  let allUsers = []
  const MAX_LIMIT = 100

  if (total <= MAX_LIMIT) {
    // 用户数不超过100，直接获取
    const res = await db.collection('users')
      .orderBy('createTime', 'desc')
      .get()
    allUsers = res.data
  } else {
    // 用户数超过100，分批获取
    let hasMore = true
    let lastId = null

    while (hasMore) {
      let query = db.collection('users')
        .orderBy('_id', 'asc')
        .limit(MAX_LIMIT)

      if (lastId) {
        query = query.where({
          _id: db.command.gt(lastId)
        })
      }

      const res = await query.get()
      allUsers = allUsers.concat(res.data)

      if (res.data.length < MAX_LIMIT) {
        hasMore = false
      } else {
        lastId = res.data[res.data.length - 1]._id
      }
    }
  }

  console.log('[getAllUsers] 获取到的用户总数:', allUsers.length)

  // 获取所有会话记录（分批获取）
  let sessions = []
  let hasMoreSessions = true
  let lastSessionId = null

  while (hasMoreSessions) {
    let sessionQuery = db.collection('user_sessions')
      .limit(MAX_LIMIT)
      .orderBy('_id', 'asc')

    if (lastSessionId) {
      sessionQuery = sessionQuery.where({
        _id: db.command.gt(lastSessionId)
      })
    }

    const sessionsRes = await sessionQuery.get()
    sessions = sessions.concat(sessionsRes.data)

    if (sessionsRes.data.length < MAX_LIMIT) {
      hasMoreSessions = false
    } else {
      lastSessionId = sessionsRes.data[sessionsRes.data.length - 1]._id
    }
  }

  console.log('[getAllUsers] 获取到的会话记录总数:', sessions.length)

  // 为每个用户计算统计数据
  const statsMap = {}
  allUsers.forEach(user => {
    // 过滤该用户的会话
    const userSessions = sessions.filter(s => s._openid === user._openid)

    // 计算总在线时长（秒）
    const totalDuration = userSessions.reduce((sum, s) => sum + (s.duration || 0), 0)

    // 会话次数
    const sessionCount = userSessions.length

    // 平均在线时长（秒）
    const avgDuration = sessionCount > 0 ? Math.floor(totalDuration / sessionCount) : 0

    // 获取最后访问时间（取最新会话的时间）
    let lastOnlineTime = 0
    if (userSessions.length > 0) {
      const latestSession = userSessions.reduce((latest, s) => {
        const sessionTime = s.sessionTime || s.createTime
        if (!sessionTime) return latest

        let timestamp = 0
        if (sessionTime.$date) {
          timestamp = new Date(sessionTime.$date).getTime()
        } else if (sessionTime instanceof Date) {
          timestamp = sessionTime.getTime()
        } else {
          timestamp = new Date(sessionTime).getTime()
        }

        return timestamp > latest ? timestamp : latest
      }, 0)
      lastOnlineTime = latestSession
    }

    // 如果没有会话记录，使用用户创建时间
    if (lastOnlineTime === 0 && user.createTime) {
      if (user.createTime.$date) {
        lastOnlineTime = new Date(user.createTime.$date).getTime()
      } else if (user.createTime instanceof Date) {
        lastOnlineTime = user.createTime.getTime()
      } else {
        lastOnlineTime = new Date(user.createTime).getTime()
      }
    }

    // 获取首次上线时间（用户创建时间）
    let firstOnlineTime = 0
    if (user.createTime) {
      if (user.createTime.$date) {
        firstOnlineTime = new Date(user.createTime.$date).getTime()
      } else if (user.createTime instanceof Date) {
        firstOnlineTime = user.createTime.getTime()
      } else {
        firstOnlineTime = new Date(user.createTime).getTime()
      }
    }

    statsMap[user._id] = {
      sessionCount,
      totalDuration,
      avgDuration,
      lastOnlineTime,
      firstOnlineTime
    }
  })

  console.log('[getAllUsers] 统计数据计算完成，用户数:', Object.keys(statsMap).length)

  // 合并用户和统计数据
  const usersWithStats = allUsers.map(user => ({
    _id: user._id,
    _openid: user._openid,
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role,
    createTime: user.createTime,
    lastOnlineTime: user.lastOnlineTime,
    visitCount: statsMap[user._id]?.sessionCount || 0,
    totalDuration: statsMap[user._id]?.totalDuration || 0,
    avgDuration: statsMap[user._id]?.avgDuration || 0,
    lastOnlineTimeStat: statsMap[user._id]?.lastOnlineTime || 0,
    firstOnlineTimeStat: statsMap[user._id]?.firstOnlineTime || 0
  }))

  console.log('[getAllUsers] 排序前前3个用户的数据:')
  usersWithStats.slice(0, 3).forEach(u => {
    console.log(`  ${u.nickname}: visitCount=${u.visitCount}, totalDuration=${u.totalDuration}, avgDuration=${u.avgDuration}`)
  })

  // 根据排序字段排序
  usersWithStats.sort((a, b) => {
    switch(sortBy) {
      case 'firstOnlineTime':
        // 首次上线时间（从早到晚，越早的越靠前）
        return (a.firstOnlineTimeStat || 0) - (b.firstOnlineTimeStat || 0)
      case 'lastOnlineTime':
        // 最后上线时间（从晚到早，最近的越靠前）
        return (b.lastOnlineTimeStat || 0) - (a.lastOnlineTimeStat || 0)
      case 'visitCount':
        // 访问次数（从多到少）
        return (b.visitCount || 0) - (a.visitCount || 0)
      case 'totalDuration':
        // 总在线时长（从长到短）
        return (b.totalDuration || 0) - (a.totalDuration || 0)
      case 'avgDuration':
        // 平均在线时长（从长到短）
        return (b.avgDuration || 0) - (a.avgDuration || 0)
      default:
        return 0
    }
  })

  console.log('[getAllUsers] 排序方式:', sortBy)
  console.log('[getAllUsers] 排序后前3个用户的数据:')
  usersWithStats.slice(0, 3).forEach(u => {
    console.log(`  ${u.nickname}: visitCount=${u.visitCount}, totalDuration=${u.totalDuration}, avgDuration=${u.avgDuration}`)
  })

  // 分页
  const skip = (page - 1) * pageSize
  const paginatedUsers = usersWithStats.slice(skip, skip + pageSize)

  console.log('[getAllUsers] 分页: page=', page, 'skip=', skip, 'pageSize=', pageSize, '返回用户数=', paginatedUsers.length)

  // 移除敏感字段和临时字段
  const safeData = paginatedUsers.map(user => ({
    _id: user._id,
    _openid: user._openid,  // 管理员需要此字段来设置聚餐日的受邀访客列表
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role,
    createTime: user.createTime,
    lastOnlineTime: user.lastOnlineTime
  }))

  return {
    success: true,
    data: safeData,
    total: total,
    page: page,
    pageSize: pageSize,
    totalPages: Math.ceil(total / pageSize),
    sortBy: sortBy,
    message: '获取成功'
  }
}

/**
 * 获取当前用户信息
 */
async function getUserInfo(openid) {
  const res = await db.collection('users').where({
    _openid: openid
  }).get()

  if (res.data.length === 0) {
    return {
      success: false,
      message: '用户不存在'
    }
  }

  return {
    success: true,
    data: res.data[0],
    message: '获取成功'
  }
}

/**
 * 更新用户角色（需要管理员权限）
 * 参数：userId, role
 * 安全限制：
 * 1. 管理员不能修改自己的角色
 * 2. 不能移除最后一个管理员
 */
async function updateUserRole(event, openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    // 审计日志：记录权限被拒绝
    await logPermissionDenied(
      openid,
      'non-admin',
      'updateUserRole',
      'user',
      event.userId || '',
      '非管理员尝试修改用户角色'
    )
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const { userId, role } = event

  if (!userId || !role) {
    return {
      success: false,
      message: '参数不完整'
    }
  }

  // 验证角色是否有效（使用统一的常量配置）
  if (!isValidRole(role)) {
    return {
      success: false,
      message: '无效的角色'
    }
  }

  // 安全检查1: 获取当前管理员信息
  const currentUserRes = await db.collection('users').where({
    _openid: openid
  }).get()

  if (currentUserRes.data.length === 0) {
    return {
      success: false,
      message: '当前用户不存在'
    }
  }

  const currentUser = currentUserRes.data[0]

  // 安全检查3: 获取目标用户信息
  const targetUserRes = await db.collection('users').doc(userId).get()

  if (!targetUserRes.data) {
    return {
      success: false,
      message: '目标用户不存在'
    }
  }

  const targetUser = targetUserRes.data

  // 安全检查2: 禁止管理员修改自己的角色
  if (currentUser._id === userId) {
    // 审计日志：记录管理员尝试修改自己的角色
    await logUserRoleUpdate(
      currentUser._id,
      currentUser.role,
      userId,
      targetUser.role,
      role,
      false,
      '管理员尝试修改自己的角色（被拒绝）'
    )
    return {
      success: false,
      message: '不能修改自己的角色'
    }
  }

  // 安全检查4: 如果要将某人从管理员降权，确保至少还有一个管理员
  if (targetUser.role === 'admin' && role !== 'admin') {
    // 查询系统中所有管理员
    const allAdminsRes = await db.collection('users').where({
      role: 'admin'
    }).get()

    if (allAdminsRes.data.length <= 1) {
      return {
        success: false,
        message: '不能移除最后一个管理员，请先指定其他管理员'
      }
    }
  }

  // 执行角色更新
  await db.collection('users').doc(userId).update({
    data: {
      role: role
    }
  })

  // 审计日志：记录成功的角色修改
  await logUserRoleUpdate(
    currentUser._id,
    currentUser.role,
    userId,
    targetUser.role,
    role,
    true,
    `成功将用户 ${targetUser.nickname || targetUser._id} 的角色从 ${targetUser.role} 修改为 ${role}`
  )

  return {
    success: true,
    message: '角色更新成功'
  }
}
