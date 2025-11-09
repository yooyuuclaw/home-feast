// cloudfunctions/user/index.js
const cloud = require('wx-server-sdk')
const { isValidRole } = require('../common/constants.js')

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
        return await getAllUsers(openid)
      case 'list':
        return await getAllUsers(openid) // list 和 getAllUsers 是同一个功能
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
 */
async function getAllUsers(openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const res = await db.collection('users')
    .orderBy('createTime', 'desc')
    .get()

  // 安全修复：移除敏感字段 _openid（但管理员需要它来设置受邀访客）
  // 注意：虽然管理员可以看到 openid，但这比之前所有人都能看到要安全得多
  const safeData = res.data.map(user => ({
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

  // 安全检查2: 禁止管理员修改自己的角色
  if (currentUser._id === userId) {
    return {
      success: false,
      message: '不能修改自己的角色'
    }
  }

  // 安全检查3: 如果要将某人从管理员降权，确保至少还有一个管理员
  const targetUserRes = await db.collection('users').doc(userId).get()

  if (!targetUserRes.data) {
    return {
      success: false,
      message: '目标用户不存在'
    }
  }

  const targetUser = targetUserRes.data

  // 如果目标用户当前是管理员，且要改为非管理员角色
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

  return {
    success: true,
    message: '角色更新成功'
  }
}
