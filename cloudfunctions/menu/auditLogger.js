// cloudfunctions/common/auditLogger.js
/**
 * 审计日志模块
 * 安全修复 #13: 记录所有敏感操作，便于安全审计和问题追溯
 */

const cloud = require('wx-server-sdk')
cloud.init({
  env: 'cloudbase-1gdysknn57ce9b9f'
})
const db = cloud.database()

/**
 * 操作类型定义
 */
const ACTION_TYPES = {
  // 用户管理
  USER_ROLE_UPDATE: 'user_role_update',
  USER_INFO_UPDATE: 'user_info_update',

  // 菜品管理
  DISH_CREATE: 'dish_create',
  DISH_UPDATE: 'dish_update',
  DISH_DELETE: 'dish_delete',

  // 聚餐日管理
  GATHERING_CREATE: 'gathering_create',
  GATHERING_UPDATE: 'gathering_update',
  GATHERING_DELETE: 'gathering_delete',

  // 订单管理
  ORDER_DELETE: 'order_delete',
  ORDER_STATUS_UPDATE: 'order_status_update',

  // 数据备份
  BACKUP_CREATE: 'backup_create',
  BACKUP_RESTORE: 'backup_restore',

  // 权限相关
  PERMISSION_DENIED: 'permission_denied',
  UNAUTHORIZED_ACCESS: 'unauthorized_access'
}

/**
 * 操作级别
 */
const ACTION_LEVELS = {
  INFO: 'info',       // 普通信息
  WARNING: 'warning', // 警告（如权限被拒绝）
  CRITICAL: 'critical' // 关键操作（如删除数据）
}

/**
 * 记录审计日志
 * @param {object} params - 日志参数
 * @param {string} params.action - 操作类型（使用 ACTION_TYPES）
 * @param {string} params.level - 操作级别（使用 ACTION_LEVELS）
 * @param {string} params.userId - 操作用户ID
 * @param {string} params.userRole - 操作用户角色
 * @param {string} params.targetType - 目标类型（user/dish/gathering/order等）
 * @param {string} params.targetId - 目标ID
 * @param {object} params.details - 详细信息（变更前后的数据）
 * @param {boolean} params.success - 操作是否成功
 * @param {string} params.message - 操作说明
 * @param {string} params.ipAddress - IP地址（可选）
 */
async function logAudit({
  action,
  level = ACTION_LEVELS.INFO,
  userId,
  userRole,
  targetType,
  targetId,
  details = {},
  success = true,
  message = '',
  ipAddress = ''
}) {
  try {
    const logEntry = {
      action,
      level,
      userId,
      userRole,
      targetType,
      targetId,
      details,
      success,
      message,
      ipAddress,
      timestamp: new Date(),
      createdAt: db.serverDate()
    }

    // 记录到数据库
    await db.collection('audit_logs').add({
      data: logEntry
    })

    // 如果是关键或警告级别，同时输出到控制台
    if (level === ACTION_LEVELS.CRITICAL || level === ACTION_LEVELS.WARNING) {
      console.log(`[AUDIT ${level.toUpperCase()}]`, JSON.stringify(logEntry, null, 2))
    }

    return { success: true }
  } catch (err) {
    // 审计日志失败不应该影响主流程，只记录错误
    console.error('审计日志记录失败:', err)
    return { success: false, error: err.message }
  }
}

/**
 * 快捷方法：记录用户角色修改
 */
async function logUserRoleUpdate(userId, userRole, targetUserId, oldRole, newRole, success, message = '') {
  return logAudit({
    action: ACTION_TYPES.USER_ROLE_UPDATE,
    level: ACTION_LEVELS.CRITICAL,
    userId,
    userRole,
    targetType: 'user',
    targetId: targetUserId,
    details: {
      oldRole,
      newRole
    },
    success,
    message: message || `角色从 ${oldRole} 变更为 ${newRole}`
  })
}

/**
 * 快捷方法：记录菜品删除
 */
async function logDishDelete(userId, userRole, dishId, dishName, success, message = '') {
  return logAudit({
    action: ACTION_TYPES.DISH_DELETE,
    level: ACTION_LEVELS.CRITICAL,
    userId,
    userRole,
    targetType: 'dish',
    targetId: dishId,
    details: {
      dishName
    },
    success,
    message: message || `删除菜品: ${dishName}`
  })
}

/**
 * 快捷方法：记录聚餐日删除
 */
async function logGatheringDelete(userId, userRole, gatheringId, gatheringDate, success, message = '') {
  return logAudit({
    action: ACTION_TYPES.GATHERING_DELETE,
    level: ACTION_LEVELS.CRITICAL,
    userId,
    userRole,
    targetType: 'gathering',
    targetId: gatheringId,
    details: {
      gatheringDate
    },
    success,
    message: message || `删除聚餐日: ${gatheringDate}`
  })
}

/**
 * 快捷方法：记录订单删除
 */
async function logOrderDelete(userId, userRole, orderId, orderDetails, success, message = '') {
  return logAudit({
    action: ACTION_TYPES.ORDER_DELETE,
    level: ACTION_LEVELS.CRITICAL,
    userId,
    userRole,
    targetType: 'order',
    targetId: orderId,
    details: orderDetails,
    success,
    message: message || '管理员删除订单'
  })
}

/**
 * 快捷方法：记录权限被拒绝
 */
async function logPermissionDenied(userId, userRole, action, targetType, targetId, message = '') {
  return logAudit({
    action: ACTION_TYPES.PERMISSION_DENIED,
    level: ACTION_LEVELS.WARNING,
    userId,
    userRole,
    targetType,
    targetId,
    details: {
      attemptedAction: action
    },
    success: false,
    message: message || '权限不足'
  })
}

/**
 * 快捷方法：记录备份操作
 */
async function logBackupCreate(userId, userRole, backupFileName, success, message = '') {
  return logAudit({
    action: ACTION_TYPES.BACKUP_CREATE,
    level: ACTION_LEVELS.CRITICAL,
    userId,
    userRole,
    targetType: 'backup',
    targetId: backupFileName,
    details: {
      fileName: backupFileName
    },
    success,
    message: message || '创建数据备份'
  })
}

module.exports = {
  logAudit,
  logUserRoleUpdate,
  logDishDelete,
  logGatheringDelete,
  logOrderDelete,
  logPermissionDenied,
  logBackupCreate,
  ACTION_TYPES,
  ACTION_LEVELS
}
