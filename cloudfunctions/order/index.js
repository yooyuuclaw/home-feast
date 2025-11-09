// cloudfunctions/order/index.js
const cloud = require('wx-server-sdk')
const { isValidOrderStatus } = require('./constants.js')

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
 * 获取用户信息
 */
async function getUserInfo(openid) {
  const res = await db.collection('users').where({
    _openid: openid
  }).get()

  if (res.data.length === 0) return null
  return res.data[0]
}

/**
 * 订单管理云函数
 * 支持操作：create, getUserOrders, getAllOrders, updateStatus, deleteOrder, adminDeleteOrder
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  try {
    switch (action) {
      case 'create':
        return await createOrder(event, openid)
      case 'getUserOrders':
        return await getUserOrders(event, openid)
      case 'getAllOrders':
        return await getAllOrders(event, openid)
      case 'updateStatus':
        return await updateOrderStatus(event, openid)
      case 'deleteOrder':
        return await deleteOrder(event, openid)
      case 'adminDeleteOrder':
        return await adminDeleteOrder(event, openid)
      default:
        return {
          success: false,
          message: '无效的操作'
        }
    }
  } catch (err) {
    console.error('订单操作失败', err)
    return {
      success: false,
      message: '操作失败',
      error: err
    }
  }
}

/**
 * 创建订单
 * 参数：dishes（菜品数组）, notes（备注）, gatheringDayId（聚餐日ID）, gatheringDayTheme（聚餐日主题）, gatheringDayDate（聚餐日日期）
 */
async function createOrder(event, openid) {
  const { dishes, notes, gatheringDayId, gatheringDayTheme, gatheringDayDate } = event

  if (!dishes || dishes.length === 0) {
    return {
      success: false,
      message: '订单不能为空'
    }
  }

  // 获取用户信息
  const userInfo = await getUserInfo(openid)
  if (!userInfo) {
    return {
      success: false,
      message: '用户信息不存在'
    }
  }

  const res = await db.collection('orders').add({
    data: {
      _openid: openid,
      userId: userInfo._id,
      userName: userInfo.nickname,
      userAvatar: userInfo.avatar,
      dishes: dishes,
      status: 'pending',
      notes: notes || '',
      gatheringDayId: gatheringDayId || '',
      gatheringDayTheme: gatheringDayTheme || '',
      gatheringDayDate: gatheringDayDate || '',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: { _id: res._id },
    message: '订单创建成功'
  }
}

/**
 * 获取所有用户的订单（聚餐场景，大家可以互相看到）
 * 根据用户角色过滤：
 * - 受邀访客：只能看到自己被邀请的聚餐日的订单
 * - 常客及以上：可以看到所有订单
 *
 * 安全修复：完善受邀访客过滤逻辑
 * - 处理没有 gatheringDayId 的旧订单
 * - 处理快速聚餐日（通过日期匹配）
 */
async function getUserOrders(event, openid) {
  // 获取用户信息
  const userInfo = await getUserInfo(openid)
  if (!userInfo) {
    return {
      success: false,
      message: '用户信息不存在'
    }
  }

  // 获取所有订单，按时间倒序
  const res = await db.collection('orders')
    .orderBy('createTime', 'desc')
    .get()

  let filteredOrders = res.data

  // 如果是受邀访客，需要过滤订单
  if (userInfo.role === 'invited_guest') {
    // 获取所有聚餐日信息
    const gatheringDaysRes = await db.collection('gathering_days').get()

    // 找出用户被邀请的聚餐日ID列表
    const invitedGatheringDayIds = gatheringDaysRes.data
      .filter(day => day.invitedGuests && day.invitedGuests.includes(openid))
      .map(day => day._id)

    // 找出用户被邀请的聚餐日期列表（用于匹配快速聚餐日）
    const invitedDates = gatheringDaysRes.data
      .filter(day => day.invitedGuests && day.invitedGuests.includes(openid))
      .map(day => day.date)

    // 只保留被邀请的聚餐日的订单
    filteredOrders = res.data.filter(order => {
      // 情况1: 订单有正式的聚餐日ID（非快速选项）
      if (order.gatheringDayId && !order.gatheringDayId.startsWith('quick-')) {
        return invitedGatheringDayIds.includes(order.gatheringDayId)
      }

      // 情况2: 快速聚餐日或有日期信息的订单（根据日期匹配）
      if (order.gatheringDayDate) {
        return invitedDates.includes(order.gatheringDayDate)
      }

      // 情况3: 旧订单没有聚餐日信息
      // 出于安全考虑，不显示给受邀访客（避免泄露不相关的订单）
      return false
    })
  }

  // 安全修复：移除订单数据中的 _openid 字段
  const safeOrders = filteredOrders.map(order => {
    const { _openid, ...safeOrder } = order
    return safeOrder
  })

  return {
    success: true,
    data: safeOrders,
    currentUserId: userInfo._id, // 返回当前用户的 _id（用于前端判断是否是自己的订单）
    message: '获取成功'
  }
}

/**
 * 获取所有订单（需要管理员权限）
 * 参数：status（可选）- 按状态筛选
 * 安全修复：即使对管理员也移除 _openid 字段
 */
async function getAllOrders(event, openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const { status } = event

  let query = db.collection('orders')

  if (status) {
    query = query.where({
      status: status
    })
  }

  const res = await query.orderBy('createTime', 'desc').get()

  // 安全修复：移除订单数据中的 _openid 字段（即使对管理员）
  const safeOrders = res.data.map(order => {
    const { _openid, ...safeOrder } = order
    return safeOrder
  })

  return {
    success: true,
    data: safeOrders,
    message: '获取成功'
  }
}

/**
 * 更新订单状态（需要管理员权限）
 * 参数：id, status
 */
async function updateOrderStatus(event, openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const { id, status } = event

  if (!id || !status) {
    return {
      success: false,
      message: '参数不完整'
    }
  }

  // 验证状态是否有效（使用统一的常量配置）
  if (!isValidOrderStatus(status)) {
    return {
      success: false,
      message: '无效的状态'
    }
  }

  await db.collection('orders').doc(id).update({
    data: {
      status: status,
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    message: '状态更新成功'
  }
}

/**
 * 删除订单（用户只能删除自己的订单）
 * 参数：id
 */
async function deleteOrder(event, openid) {
  const { id } = event

  if (!id) {
    return {
      success: false,
      message: '订单ID不能为空'
    }
  }

  // 先查询订单，确认是否属于当前用户
  const orderRes = await db.collection('orders').doc(id).get()

  if (!orderRes.data) {
    return {
      success: false,
      message: '订单不存在'
    }
  }

  // 检查订单是否属于当前用户
  if (orderRes.data._openid !== openid) {
    return {
      success: false,
      message: '无权删除他人订单'
    }
  }

  // 删除订单
  await db.collection('orders').doc(id).remove()

  return {
    success: true,
    message: '订单删除成功'
  }
}

/**
 * 管理员删除订单（需要管理员权限，可以删除任何订单）
 * 参数：id
 * 安全修复：在执行删除前二次验证权限，防止竞态条件
 */
async function adminDeleteOrder(event, openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const { id } = event

  if (!id) {
    return {
      success: false,
      message: '订单ID不能为空'
    }
  }

  // 先查询订单是否存在
  const orderRes = await db.collection('orders').doc(id).get()

  if (!orderRes.data) {
    return {
      success: false,
      message: '订单不存在'
    }
  }

  // 安全修复：在执行关键操作前再次验证权限
  // 防止在第一次验证后、删除操作前，用户角色被修改
  const isStillAdmin = await checkAdmin(openid)
  if (!isStillAdmin) {
    return {
      success: false,
      message: '权限已变更，操作取消'
    }
  }

  // 管理员可以删除任何订单
  await db.collection('orders').doc(id).remove()

  return {
    success: true,
    message: '订单删除成功'
  }
}
