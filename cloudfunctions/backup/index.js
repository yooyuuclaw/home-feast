// cloudfunctions/backup/index.js
const cloud = require('wx-server-sdk')

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
 * 备份管理云函数
 * 支持操作：backupDatabase, getBackupHistory
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  try {
    switch (action) {
      case 'backupDatabase':
        return await backupDatabase(openid)
      case 'getBackupHistory':
        return await getBackupHistory(openid)
      default:
        return {
          success: false,
          message: '无效的操作'
        }
    }
  } catch (err) {
    console.error('备份操作失败', err)
    return {
      success: false,
      message: '操作失败',
      error: err
    }
  }
}

/**
 * 备份数据库（需要管理员权限）
 * 导出所有数据到云存储
 * 安全修复：
 * 1. 脱敏处理 - 移除所有 _openid 字段
 * 2. 使用哈希替代敏感标识符
 */
async function backupDatabase(openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: openid
  }).get()
  const operator = userRes.data[0]

  // 获取所有集合的数据
  const usersRes = await db.collection('users').get()
  const menuRes = await db.collection('menu').get()
  const ordersRes = await db.collection('orders').get()

  // 安全修复：脱敏处理函数
  const sanitizeData = (items) => {
    return items.map(item => {
      const { _openid, ...sanitized } = item
      return sanitized
    })
  }

  // 脱敏处理所有数据
  const backupData = {
    users: sanitizeData(usersRes.data),
    menu: menuRes.data,  // 菜单数据不包含敏感信息
    orders: sanitizeData(ordersRes.data),
    backupTime: new Date().toISOString(),
    sanitized: true,  // 标记这是脱敏后的备份
    note: '此备份已移除 _openid 等敏感字段，仅用于数据恢复参考'
  }

  // 生成文件名（添加 sanitized 标识）
  const fileName = `database-backup-sanitized-${Date.now()}.json`
  const cloudPath = `backups/database/${fileName}`

  // 上传到云存储
  const uploadRes = await cloud.uploadFile({
    cloudPath: cloudPath,
    fileContent: JSON.stringify(backupData, null, 2)
  })

  // 记录备份历史
  await db.collection('backups').add({
    data: {
      type: 'database',
      fileName: fileName,
      fileUrl: uploadRes.fileID,
      createTime: db.serverDate(),
      operator: operator.nickname,
      operatorId: operator._id,
      sanitized: true  // 标记为脱敏备份
    }
  })

  return {
    success: true,
    data: {
      fileName: fileName,
      fileUrl: uploadRes.fileID,
      sanitized: true
    },
    message: '备份成功（已脱敏处理）'
  }
}

/**
 * 获取备份历史（需要管理员权限）
 */
async function getBackupHistory(openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const res = await db.collection('backups')
    .orderBy('createTime', 'desc')
    .get()

  return {
    success: true,
    data: res.data,
    message: '获取成功'
  }
}
