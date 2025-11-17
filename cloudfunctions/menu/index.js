// cloudfunctions/menu/index.js
const cloud = require('wx-server-sdk')
const { isValidCategory } = require('./constants.js')
const { handleErrorWithType } = require('./errorHandler.js')
const { logDishDelete, logPermissionDenied, logAudit, ACTION_TYPES, ACTION_LEVELS } = require('./auditLogger.js')

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

/**
 * 菜单管理云函数
 * 支持操作：getList, add, update, delete
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  try {
    switch (action) {
      case 'getList':
        return await getMenuList(event)
      case 'add':
        return await addDish(event, openid)
      case 'update':
        return await updateDish(event, openid)
      case 'delete':
        return await deleteDish(event, openid)
      default:
        return {
          success: false,
          message: '无效的操作'
        }
    }
  } catch (err) {
    console.error('菜单操作失败', err)
    // 安全修复 #12: 不返回详细错误信息，避免泄露系统信息
    return {
      success: false,
      message: '操作失败，请稍后重试',
      errorCode: err.code || err.errCode || 'UNKNOWN_ERROR'
    }
  }
}

/**
 * 获取菜单列表
 * 参数：category（可选）- 按分类筛选
 *      status（可选）- 按状态筛选，传 null 获取所有状态
 */
async function getMenuList(event) {
  const { category, status } = event

  let query = db.collection('menu')
  const where = {}

  // 添加分类筛选
  if (category) {
    where.category = category
  }

  // 添加状态筛选
  // status === null 表示获取所有状态
  // status === undefined 表示默认只获取上架的
  // status === 'online' 或 'offline' 表示获取特定状态
  if (status === null) {
    // 不添加状态筛选，获取所有状态的菜品
  } else if (status !== undefined) {
    where.status = status
  } else {
    // 默认只显示上架的菜品（用于普通用户）
    where.status = 'online'
  }

  if (Object.keys(where).length > 0) {
    query = query.where(where)
  }

  const res = await query.orderBy('createTime', 'desc').get()

  return {
    success: true,
    data: res.data,
    message: '获取成功'
  }
}

/**
 * 添加菜品（需要管理员权限）
 * 参数：name, image, category, ingredients
 */
async function addDish(event, openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const { name, image, category, ingredients } = event

  if (!name || !category) {
    return {
      success: false,
      message: '参数不完整'
    }
  }

  // 验证分类是否有效（使用统一的常量配置）
  if (!isValidCategory(category)) {
    return {
      success: false,
      message: '无效的分类'
    }
  }

  const res = await db.collection('menu').add({
    data: {
      name,
      image: image || '',
      category,
      status: 'online',
      ingredients: ingredients || [],  // 添加食材字段
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: { _id: res._id },
    message: '添加成功'
  }
}

/**
 * 更新菜品（需要管理员权限）
 * 参数：id, name, image, category, status, ingredients
 */
async function updateDish(event, openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const { id, name, image, category, status, ingredients } = event

  if (!id) {
    return {
      success: false,
      message: '缺少菜品ID'
    }
  }

  const updateData = {
    updateTime: db.serverDate()
  }

  if (name !== undefined) updateData.name = name
  if (image !== undefined) updateData.image = image
  if (category !== undefined) {
    // 验证分类是否有效（使用统一的常量配置）
    if (!isValidCategory(category)) {
      return {
        success: false,
        message: '无效的分类'
      }
    }
    updateData.category = category
  }
  if (status !== undefined) updateData.status = status
  if (ingredients !== undefined) updateData.ingredients = ingredients  // 添加食材更新

  await db.collection('menu').doc(id).update({
    data: updateData
  })

  return {
    success: true,
    message: '更新成功'
  }
}

/**
 * 删除菜品（需要管理员权限）
 * 参数：id
 * 安全修复：在执行删除前二次验证权限，防止竞态条件
 */
async function deleteDish(event, openid) {
  // 首先获取用户信息用于审计日志
  const userRes = await db.collection('users').where({ _openid: openid }).get()
  const userInfo = userRes.data.length > 0 ? userRes.data[0] : { _id: openid, role: 'unknown' }

  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    // 审计日志：记录未授权的删除尝试
    await logPermissionDenied(
      userInfo._id,
      userInfo.role,
      'deleteDish',
      'dish',
      event.id || '',
      '非管理员尝试删除菜品'
    )
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const { id } = event

  if (!id) {
    return {
      success: false,
      message: '缺少菜品ID'
    }
  }

  // 获取菜品信息用于审计日志
  const dishRes = await db.collection('menu').doc(id).get()
  if (!dishRes.data) {
    return {
      success: false,
      message: '菜品不存在'
    }
  }
  const dishInfo = dishRes.data

  // 安全修复：在执行关键操作前再次验证权限
  // 防止在第一次验证后、删除操作前，用户角色被修改
  const isStillAdmin = await checkAdmin(openid)
  if (!isStillAdmin) {
    // 审计日志：记录权限变更导致的操作取消
    await logDishDelete(
      userInfo._id,
      'admin-revoked',
      id,
      dishInfo.name,
      false,
      '权限在操作过程中被撤销'
    )
    return {
      success: false,
      message: '权限已变更，操作取消'
    }
  }

  await db.collection('menu').doc(id).remove()

  // 审计日志：记录成功的菜品删除
  await logDishDelete(
    userInfo._id,
    userInfo.role,
    id,
    dishInfo.name,
    true,
    `成功删除菜品: ${dishInfo.name} (分类: ${dishInfo.category})`
  )

  return {
    success: true,
    message: '删除成功'
  }
}
