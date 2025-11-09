// cloudfunctions/gathering-day/index.js
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
 * 聚餐日管理云函数
 * 支持操作：create, list, update, delete
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  try {
    switch (action) {
      case 'create':
        return await createGatheringDay(event, openid)
      case 'list':
        return await listGatheringDays(event, openid)
      case 'update':
        return await updateGatheringDay(event, openid)
      case 'delete':
        return await deleteGatheringDay(event, openid)
      default:
        return {
          success: false,
          message: '无效的操作'
        }
    }
  } catch (err) {
    console.error('聚餐日操作失败', err)
    return {
      success: false,
      message: '操作失败',
      error: err
    }
  }
}

/**
 * 创建聚餐日（需要管理员权限）
 * 参数：theme（主题）, date（日期）, meals（餐次：breakfast/lunch/dinner）, invitedGuests（受邀访客openid数组）
 */
async function createGatheringDay(event, openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const { theme, date, meals, invitedGuests } = event

  if (!theme || !date || !meals || meals.length === 0) {
    return {
      success: false,
      message: '主题、日期和餐次不能为空'
    }
  }

  // 检查日期是否已存在
  const existRes = await db.collection('gathering_days')
    .where({ date: date })
    .get()

  if (existRes.data.length > 0) {
    return {
      success: false,
      message: '该日期已存在聚餐日'
    }
  }

  const res = await db.collection('gathering_days').add({
    data: {
      theme: theme,
      date: date,
      meals: meals, // ['breakfast', 'lunch', 'dinner']
      invitedGuests: invitedGuests || [], // 受邀访客的openid数组
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: { _id: res._id },
    message: '聚餐日创建成功'
  }
}

/**
 * 获取聚餐日列表
 * 根据用户角色返回不同数据：
 * - 管理员：看到所有聚餐日和完整受邀访客列表
 * - 常客/厨师：看到所有聚餐日，但不显示具体受邀访客（只显示人数和自己是否被邀请）
 * - 受邀访客：只看到自己被邀请的聚餐日
 * - 未受邀访客：看不到任何聚餐日
 */
async function listGatheringDays(event, openid) {
  // 1. 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: openid
  }).get()

  if (userRes.data.length === 0) {
    return {
      success: false,
      message: '用户不存在'
    }
  }

  const user = userRes.data[0]
  const userRole = user.role

  // 2. 获取所有聚餐日
  const res = await db.collection('gathering_days')
    .orderBy('date', 'desc')
    .get()

  let filteredData = res.data

  // 3. 根据角色过滤数据
  if (userRole === 'invited_guest') {
    // 受邀访客：只能看到自己被邀请的聚餐日
    filteredData = res.data.filter(day =>
      day.invitedGuests && day.invitedGuests.includes(openid)
    )
  } else if (userRole === 'uninvited_guest') {
    // 未受邀访客：不能看到任何聚餐日
    filteredData = []
  }
  // admin, chef, regular: 可以看到所有聚餐日

  // 4. 脱敏处理：移除敏感字段（对非管理员）
  if (userRole !== 'admin') {
    filteredData = filteredData.map(day => {
      const { invitedGuests, ...safeData } = day
      return {
        ...safeData,
        invitedGuestsCount: invitedGuests ? invitedGuests.length : 0,  // 只返回人数
        isInvited: invitedGuests ? invitedGuests.includes(openid) : false  // 只告知当前用户是否被邀请
      }
    })
  }

  return {
    success: true,
    data: filteredData,
    message: '获取成功'
  }
}

/**
 * 更新聚餐日（需要管理员权限）
 * 参数：id, theme, date, meals, invitedGuests
 */
async function updateGatheringDay(event, openid) {
  const isAdmin = await checkAdmin(openid)
  if (!isAdmin) {
    return {
      success: false,
      message: '无权限操作'
    }
  }

  const { id, theme, date, meals, invitedGuests } = event

  if (!id) {
    return {
      success: false,
      message: '聚餐日ID不能为空'
    }
  }

  if (!theme || !date || !meals || meals.length === 0) {
    return {
      success: false,
      message: '主题、日期和餐次不能为空'
    }
  }

  // 检查日期是否与其他聚餐日冲突
  const existRes = await db.collection('gathering_days')
    .where({
      date: date,
      _id: db.command.neq(id)
    })
    .get()

  if (existRes.data.length > 0) {
    return {
      success: false,
      message: '该日期已存在其他聚餐日'
    }
  }

  await db.collection('gathering_days').doc(id).update({
    data: {
      theme: theme,
      date: date,
      meals: meals,
      invitedGuests: invitedGuests || [], // 受邀访客的openid数组
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    message: '聚餐日更新成功'
  }
}

/**
 * 删除聚餐日（需要管理员权限）
 * 参数：id
 */
async function deleteGatheringDay(event, openid) {
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
      message: '聚餐日ID不能为空'
    }
  }

  await db.collection('gathering_days').doc(id).remove()

  return {
    success: true,
    message: '聚餐日删除成功'
  }
}
