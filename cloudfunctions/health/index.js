// cloudfunctions/health/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloudbase-1gdysknn57ce9b9f'
})

const db = cloud.database()
const _ = db.command

/**
 * 检查用户权限（非未受邀访客可访问）
 */
async function checkPermission(openid) {
  try {
    const res = await db.collection('users').where({
      _openid: openid
    }).get()

    if (res.data.length === 0) {
      console.log('用户不存在于users集合中，openid:', openid)
      return false
    }

    // 只有未受邀访客无权限，其他角色（invited_guest, regular, chef, admin）都可以访问
    const hasPermission = res.data[0].role !== 'uninvited_guest'
    console.log('用户角色:', res.data[0].role, '是否有权限:', hasPermission)
    return hasPermission
  } catch (err) {
    console.error('检查权限失败:', err)
    return false
  }
}

/**
 * 添加健康记录
 */
async function addHealthRecord(event, openid) {
  const { type, value, displayValue, recordDate, note, extra } = event

  // 验证必填字段
  if (!type || !value || !displayValue || !recordDate) {
    return {
      success: false,
      message: '缺少必填字段'
    }
  }

  // 验证类型
  const validTypes = ['weight', 'height', 'bloodPressure', 'bloodOxygen', 'bloodSugar', 'uricAcid']
  if (!validTypes.includes(type)) {
    return {
      success: false,
      message: '无效的健康指标类型'
    }
  }

  try {
    const result = await db.collection('health_records').add({
      data: {
        _openid: openid,
        type: type,
        value: value,
        displayValue: displayValue,
        recordDate: recordDate,
        note: note || '',
        extra: extra || {},
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    return {
      success: true,
      data: {
        _id: result._id
      }
    }
  } catch (err) {
    console.error('添加健康记录失败', err)
    return {
      success: false,
      message: '添加失败'
    }
  }
}

/**
 * 获取健康记录列表
 */
async function getHealthRecords(event, openid) {
  const { filter, limit = 100, targetOpenid } = event

  try {
    // 确定要查询的openid
    let queryOpenid = openid

    // 如果要查看他人数据，需要检查权限
    if (targetOpenid && targetOpenid !== openid) {
      const authCheck = await db.collection('health_authorizations').where({
        owner_openid: targetOpenid,
        authorized_openid: openid,
        status: 'active'
      }).get()

      if (authCheck.data.length === 0) {
        return {
          success: false,
          message: '无权查看该用户的健康数据'
        }
      }

      queryOpenid = targetOpenid
    }

    // 构建查询条件
    let query = db.collection('health_records').where({
      _openid: queryOpenid
    })

    // 如果有类型筛选
    if (filter) {
      query = query.where({
        _openid: queryOpenid,
        type: filter
      })
    }

    // 按记录日期倒序
    const result = await query
      .orderBy('recordDate', 'desc')
      .limit(limit)
      .get()

    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('获取健康记录失败', err)
    return {
      success: false,
      message: '获取记录失败',
      data: []
    }
  }
}

/**
 * 删除健康记录
 */
async function deleteHealthRecord(event, openid) {
  const { id } = event

  if (!id) {
    return {
      success: false,
      message: '缺少记录ID'
    }
  }

  try {
    // 先检查记录是否属于当前用户
    const checkResult = await db.collection('health_records').doc(id).get()

    if (!checkResult.data) {
      return {
        success: false,
        message: '记录不存在'
      }
    }

    if (checkResult.data._openid !== openid) {
      return {
        success: false,
        message: '无权删除他人的记录'
      }
    }

    // 删除记录
    await db.collection('health_records').doc(id).remove()

    return {
      success: true,
      message: '删除成功'
    }
  } catch (err) {
    console.error('删除健康记录失败', err)
    return {
      success: false,
      message: '删除失败'
    }
  }
}

/**
 * 获取统计数据
 */
async function getStatistics(event, openid) {
  const { type, days = 30 } = event

  if (!type) {
    return {
      success: false,
      message: '缺少类型参数'
    }
  }

  try {
    // 计算起始日期
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

    const result = await db.collection('health_records')
      .where({
        _openid: openid,
        type: type,
        recordDate: _.gte(startDate.toISOString()).and(_.lte(endDate.toISOString()))
      })
      .orderBy('recordDate', 'asc')
      .limit(1000)
      .get()

    // 计算统计数据
    const records = result.data
    let total = 0
    let max = -Infinity
    let min = Infinity

    records.forEach(record => {
      // 对于血压，取收缩压
      let numValue
      if (type === 'bloodPressure') {
        numValue = parseFloat(record.value.split('/')[0])
      } else {
        numValue = parseFloat(record.value)
      }

      total += numValue
      max = Math.max(max, numValue)
      min = Math.min(min, numValue)
    })

    const avg = records.length > 0 ? (total / records.length).toFixed(2) : 0

    return {
      success: true,
      data: {
        records: records,
        count: records.length,
        avg: avg,
        max: max === -Infinity ? 0 : max,
        min: min === Infinity ? 0 : min
      }
    }
  } catch (err) {
    console.error('获取统计数据失败', err)
    return {
      success: false,
      message: '获取统计失败'
    }
  }
}

/**
 * 添加喝水记录
 */
async function addWaterRecord(event, openid) {
  const { amount } = event

  if (!amount || amount <= 0) {
    return {
      success: false,
      message: '水量无效'
    }
  }

  try {
    const now = new Date()
    const result = await db.collection('water_records').add({
      data: {
        _openid: openid,
        amount: amount,
        date: now.toISOString(),
        createTime: db.serverDate()
      }
    })

    return {
      success: true,
      data: {
        _id: result._id
      }
    }
  } catch (err) {
    console.error('添加喝水记录失败', err)
    return {
      success: false,
      message: '添加失败'
    }
  }
}

/**
 * 获取喝水记录
 */
async function getWaterRecords(event, openid) {
  const { targetOpenid } = event

  try {
    // 确定要查询的openid
    let queryOpenid = openid

    // 如果要查看他人数据，需要检查权限
    if (targetOpenid && targetOpenid !== openid) {
      const authCheck = await db.collection('health_authorizations').where({
        owner_openid: targetOpenid,
        authorized_openid: openid,
        status: 'active'
      }).get()

      if (authCheck.data.length === 0) {
        return {
          success: false,
          message: '无权查看该用户的健康数据'
        }
      }

      queryOpenid = targetOpenid
    }

    // 获取最近30天的记录
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

    const result = await db.collection('water_records')
      .where({
        _openid: queryOpenid,
        date: _.gte(startDate.toISOString())
      })
      .orderBy('date', 'desc')
      .limit(500)
      .get()

    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('获取喝水记录失败', err)
    return {
      success: false,
      message: '获取记录失败',
      data: []
    }
  }
}

/**
 * 删除喝水记录
 */
async function deleteWaterRecord(event, openid) {
  const { id } = event

  if (!id) {
    return {
      success: false,
      message: '缺少记录ID'
    }
  }

  try {
    // 检查记录是否属于当前用户
    const checkResult = await db.collection('water_records').doc(id).get()

    if (!checkResult.data) {
      return {
        success: false,
        message: '记录不存在'
      }
    }

    if (checkResult.data._openid !== openid) {
      return {
        success: false,
        message: '无权删除他人的记录'
      }
    }

    // 删除记录
    await db.collection('water_records').doc(id).remove()

    return {
      success: true,
      message: '删除成功'
    }
  } catch (err) {
    console.error('删除喝水记录失败', err)
    return {
      success: false,
      message: '删除失败'
    }
  }
}

/**
 * 添加药品
 */
async function addMedicine(event, openid) {
  const { name, dosage, times } = event

  if (!name || !dosage || !times || times.length === 0) {
    return {
      success: false,
      message: '缺少必填字段'
    }
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const timesWithStatus = times.map(time => ({
      time: time,
      taken: false,
      lastTakeDate: null
    }))

    const result = await db.collection('medicines').add({
      data: {
        _openid: openid,
        name: name,
        dosage: dosage,
        times: timesWithStatus,
        createTime: db.serverDate()
      }
    })

    return {
      success: true,
      data: {
        _id: result._id
      }
    }
  } catch (err) {
    console.error('添加药品失败', err)
    return {
      success: false,
      message: '添加失败'
    }
  }
}

/**
 * 获取药品列表
 */
async function getMedicines(event, openid) {
  const { targetOpenid } = event

  try {
    // 确定要查询的openid
    let queryOpenid = openid

    // 如果要查看他人数据，需要检查权限
    if (targetOpenid && targetOpenid !== openid) {
      const authCheck = await db.collection('health_authorizations').where({
        owner_openid: targetOpenid,
        authorized_openid: openid,
        status: 'active'
      }).get()

      if (authCheck.data.length === 0) {
        return {
          success: false,
          message: '无权查看该用户的健康数据'
        }
      }

      queryOpenid = targetOpenid
    }

    const result = await db.collection('medicines')
      .where({
        _openid: queryOpenid
      })
      .orderBy('createTime', 'desc')
      .get()

    // 处理今日服用状态
    const today = new Date().toISOString().split('T')[0]
    const medicines = result.data.map(medicine => {
      medicine.times = medicine.times.map(timeItem => ({
        ...timeItem,
        taken: timeItem.lastTakeDate === today
      }))
      return medicine
    })

    return {
      success: true,
      data: medicines
    }
  } catch (err) {
    console.error('获取药品列表失败', err)
    return {
      success: false,
      message: '获取失败',
      data: []
    }
  }
}

/**
 * 切换服药状态
 */
async function toggleMedicineTaken(event, openid) {
  const { medicineId, timeIndex } = event

  if (!medicineId || timeIndex === undefined) {
    return {
      success: false,
      message: '缺少参数'
    }
  }

  try {
    // 获取药品信息
    const medicineRes = await db.collection('medicines').doc(medicineId).get()

    if (!medicineRes.data) {
      return {
        success: false,
        message: '药品不存在'
      }
    }

    const medicine = medicineRes.data

    if (medicine._openid !== openid) {
      return {
        success: false,
        message: '无权操作'
      }
    }

    // 更新服药状态
    const today = new Date().toISOString().split('T')[0]
    const times = medicine.times
    const currentStatus = times[timeIndex].lastTakeDate === today

    times[timeIndex].lastTakeDate = currentStatus ? null : today

    await db.collection('medicines').doc(medicineId).update({
      data: {
        times: times
      }
    })

    return {
      success: true,
      message: '更新成功'
    }
  } catch (err) {
    console.error('切换服药状态失败', err)
    return {
      success: false,
      message: '操作失败'
    }
  }
}

/**
 * 删除药品
 */
async function deleteMedicine(event, openid) {
  const { id } = event

  if (!id) {
    return {
      success: false,
      message: '缺少药品ID'
    }
  }

  try {
    // 检查药品是否属于当前用户
    const checkResult = await db.collection('medicines').doc(id).get()

    if (!checkResult.data) {
      return {
        success: false,
        message: '药品不存在'
      }
    }

    if (checkResult.data._openid !== openid) {
      return {
        success: false,
        message: '无权删除他人的药品'
      }
    }

    // 删除药品
    await db.collection('medicines').doc(id).remove()

    return {
      success: true,
      message: '删除成功'
    }
  } catch (err) {
    console.error('删除药品失败', err)
    return {
      success: false,
      message: '删除失败'
    }
  }
}

/**
 * 生成6位随机授权码
 */
function generateAuthCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 生成授权码
 */
async function generateAuthorizationCode(event, openid) {
  try {
    // 获取用户信息
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

    // 生成6位随机数字
    const code = generateAuthCode()
    const now = new Date()
    const expireTime = new Date(now.getTime() + 5 * 60 * 1000) // 5分钟后过期

    // 先删除该用户之前未使用的授权码
    await db.collection('health_auth_codes').where({
      owner_openid: openid,
      used: false
    }).remove()

    // 添加新授权码
    const result = await db.collection('health_auth_codes').add({
      data: {
        code: code,
        owner_openid: openid,
        owner_nickname: user.nickname || '未知用户',
        createTime: db.serverDate(),
        expireTime: expireTime,
        used: false
      }
    })

    return {
      success: true,
      data: {
        code: code,
        expireTime: expireTime
      },
      message: '授权码生成成功'
    }
  } catch (err) {
    console.error('生成授权码失败', err)
    return {
      success: false,
      message: '生成授权码失败'
    }
  }
}

/**
 * 使用授权码进行授权
 */
async function useAuthorizationCode(event, openid) {
  const { code } = event

  if (!code || code.length !== 6) {
    return {
      success: false,
      message: '授权码格式错误'
    }
  }

  try {
    // 查找授权码
    const codeRes = await db.collection('health_auth_codes').where({
      code: code,
      used: false
    }).get()

    if (codeRes.data.length === 0) {
      return {
        success: false,
        message: '授权码不存在或已使用'
      }
    }

    const authCode = codeRes.data[0]

    // 检查是否过期
    const now = new Date()
    if (now > new Date(authCode.expireTime)) {
      return {
        success: false,
        message: '授权码已过期'
      }
    }

    // 不能给自己授权
    if (authCode.owner_openid === openid) {
      return {
        success: false,
        message: '不能给自己授权'
      }
    }

    // 获取当前用户信息
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get()

    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      }
    }

    const currentUser = userRes.data[0]

    // 检查用户角色（不能是未受邀访客）
    if (currentUser.role === 'uninvited_guest') {
      return {
        success: false,
        message: '未受邀访客无法被授权'
      }
    }

    // 检查是否已经授权过
    const existingAuth = await db.collection('health_authorizations').where({
      owner_openid: authCode.owner_openid,
      authorized_openid: openid,
      status: 'active'
    }).get()

    if (existingAuth.data.length > 0) {
      return {
        success: false,
        message: '已经拥有查看权限'
      }
    }

    // 创建授权记录
    await db.collection('health_authorizations').add({
      data: {
        owner_openid: authCode.owner_openid,
        authorized_openid: openid,
        owner_nickname: authCode.owner_nickname,
        authorized_nickname: currentUser.nickname || '未知用户',
        createTime: db.serverDate(),
        status: 'active'
      }
    })

    // 标记授权码为已使用
    await db.collection('health_auth_codes').doc(authCode._id).update({
      data: {
        used: true
      }
    })

    return {
      success: true,
      message: `已获得查看 ${authCode.owner_nickname} 健康数据的权限`,
      data: {
        owner_nickname: authCode.owner_nickname
      }
    }
  } catch (err) {
    console.error('使用授权码失败', err)
    return {
      success: false,
      message: '授权失败'
    }
  }
}

/**
 * 获取我授权给他人的列表
 */
async function getMyAuthorizations(event, openid) {
  try {
    const result = await db.collection('health_authorizations')
      .where({
        owner_openid: openid,
        status: 'active'
      })
      .orderBy('createTime', 'desc')
      .get()

    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('获取授权列表失败', err)
    return {
      success: false,
      message: '获取失败',
      data: []
    }
  }
}

/**
 * 获取授权我查看的列表
 */
async function getAuthorizedToMe(event, openid) {
  try {
    const result = await db.collection('health_authorizations')
      .where({
        authorized_openid: openid,
        status: 'active'
      })
      .orderBy('createTime', 'desc')
      .get()

    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('获取授权列表失败', err)
    return {
      success: false,
      message: '获取失败',
      data: []
    }
  }
}

/**
 * 撤销授权
 */
async function revokeAuthorization(event, openid) {
  const { authId } = event

  if (!authId) {
    return {
      success: false,
      message: '缺少授权ID'
    }
  }

  try {
    // 检查授权记录
    const authRes = await db.collection('health_authorizations').doc(authId).get()

    if (!authRes.data) {
      return {
        success: false,
        message: '授权记录不存在'
      }
    }

    const auth = authRes.data

    // 只有授权拥有者可以撤销
    if (auth.owner_openid !== openid) {
      return {
        success: false,
        message: '无权撤销此授权'
      }
    }

    // 更新状态为已撤销
    await db.collection('health_authorizations').doc(authId).update({
      data: {
        status: 'revoked',
        revokeTime: db.serverDate()
      }
    })

    return {
      success: true,
      message: '授权已撤销'
    }
  } catch (err) {
    console.error('撤销授权失败', err)
    return {
      success: false,
      message: '撤销失败'
    }
  }
}

/**
 * 检查是否有权查看某人的健康数据
 */
async function checkViewPermission(event, openid) {
  const { targetOpenid } = event

  if (!targetOpenid) {
    return {
      success: false,
      message: '缺少目标用户ID'
    }
  }

  // 查看自己的数据始终允许
  if (targetOpenid === openid) {
    return {
      success: true,
      hasPermission: true
    }
  }

  try {
    // 检查是否有授权记录
    const authRes = await db.collection('health_authorizations').where({
      owner_openid: targetOpenid,
      authorized_openid: openid,
      status: 'active'
    }).get()

    return {
      success: true,
      hasPermission: authRes.data.length > 0
    }
  } catch (err) {
    console.error('检查查看权限失败', err)
    return {
      success: false,
      message: '检查失败',
      hasPermission: false
    }
  }
}

/**
 * 健康数据管理云函数
 * 支持操作：add, list, delete, statistics, addWaterRecord, getWaterRecords, deleteWaterRecord,
 * addMedicine, getMedicines, toggleMedicineTaken, deleteMedicine,
 * generateAuthCode, useAuthCode, getMyAuthorizations, getAuthorizedToMe, revokeAuthorization, checkViewPermission
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  console.log('health云函数被调用, action:', action, 'openid:', openid)

  // 检查权限
  const hasPermission = await checkPermission(openid)
  if (!hasPermission) {
    console.log('用户无权限访问健康管理功能')
    return {
      success: false,
      message: '您需要先在首页授权登录，才能使用健康管理功能'
    }
  }

  try {
    switch (action) {
      case 'add':
        return await addHealthRecord(event, openid)
      case 'list':
        return await getHealthRecords(event, openid)
      case 'delete':
        return await deleteHealthRecord(event, openid)
      case 'statistics':
        return await getStatistics(event, openid)
      case 'addWaterRecord':
        return await addWaterRecord(event, openid)
      case 'getWaterRecords':
        return await getWaterRecords(event, openid)
      case 'deleteWaterRecord':
        return await deleteWaterRecord(event, openid)
      case 'addMedicine':
        return await addMedicine(event, openid)
      case 'getMedicines':
        return await getMedicines(event, openid)
      case 'toggleMedicineTaken':
        return await toggleMedicineTaken(event, openid)
      case 'deleteMedicine':
        return await deleteMedicine(event, openid)
      case 'generateAuthCode':
        return await generateAuthorizationCode(event, openid)
      case 'useAuthCode':
        return await useAuthorizationCode(event, openid)
      case 'getMyAuthorizations':
        return await getMyAuthorizations(event, openid)
      case 'getAuthorizedToMe':
        return await getAuthorizedToMe(event, openid)
      case 'revokeAuthorization':
        return await revokeAuthorization(event, openid)
      case 'checkViewPermission':
        return await checkViewPermission(event, openid)
      default:
        return {
          success: false,
          message: '无效的操作'
        }
    }
  } catch (err) {
    console.error('健康数据操作失败', err)
    return {
      success: false,
      message: '操作失败: ' + err.message
    }
  }
}
