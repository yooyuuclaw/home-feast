// cloudfunctions/order/index.js
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

    // 只保留被邀请的聚餐日的订单
    filteredOrders = res.data.filter(order => {
      // 如果订单有聚餐日ID，检查是否在被邀请列表中
      if (order.gatheringDayId) {
        return invitedGatheringDayIds.includes(order.gatheringDayId)
      }
      // 没有聚餐日ID的订单不显示给受邀访客
      return false
    })
  }

  return {
    success: true,
    data: filteredOrders,
    currentOpenid: openid, // 返回当前用户的 openid
    message: '获取成功'
  }
}

/**
 * 获取所有订单（需要管理员权限）
 * 参数：status（可选）- 按状态筛选
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

  return {
    success: true,
    data: res.data,
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

  // 验证状态是否有效
  const validStatus = ['pending', 'confirmed', 'completed']
  if (!validStatus.includes(status)) {
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

  // 管理员可以删除任何订单
  await db.collection('orders').doc(id).remove()

  return {
    success: true,
    message: '订单删除成功'
  }
}
