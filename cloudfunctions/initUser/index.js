// cloudfunctions/initUser/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloudbase-1gdysknn57ce9b9f'
})

const db = cloud.database()

/**
 * 初始化用户信息
 * 首次登录时自动创建用户记录
 * 接收参数：nickname（昵称）、avatar（头像）
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { nickname, avatar } = event

  try {
    // 查询用户是否已存在
    const userRes = await db.collection('users').where({
      _openid: openid
    }).get()

    let userData

    if (userRes.data.length === 0) {
      // 用户不存在，创建新用户（默认为未受邀访客）
      const createRes = await db.collection('users').add({
        data: {
          _openid: openid,
          role: 'uninvited_guest', // 未受邀访客
          nickname: nickname || '昵称',
          avatar: avatar || '',
          createTime: db.serverDate()
        }
      })

      // 获取新创建的用户信息
      const newUserRes = await db.collection('users').doc(createRes._id).get()
      userData = newUserRes.data
    } else {
      // 用户已存在，如果传入了新的昵称或头像，则更新
      userData = userRes.data[0]

      // 检查是否需要更新用户信息
      const updateData = {}
      if (nickname && nickname !== userData.nickname) {
        updateData.nickname = nickname
      }
      if (avatar && avatar !== userData.avatar) {
        updateData.avatar = avatar
      }

      // 每次调用都更新最后上线时间
      updateData.lastOnlineTime = db.serverDate()

      // 执行更新
      await db.collection('users').doc(userData._id).update({
        data: updateData
      })

      // 重新获取用户数据以包含最新的 lastOnlineTime
      const updatedUserRes = await db.collection('users').doc(userData._id).get()
      userData = updatedUserRes.data

      // 用户每次打开小程序时，记录一次短会话（用于统计访问次数）
      // 这样即使用户很快关闭小程序，也能被统计到
      try {
        await db.collection('user_sessions').add({
          data: {
            _openid: openid,
            duration: 1, // 记录1秒，表示这是一次启动记录
            sessionTime: db.serverDate(),
            createTime: db.serverDate(),
            type: 'launch' // 标记为启动类型会话
          }
        })
      } catch (sessionErr) {
        console.error('记录启动会话失败', sessionErr)
        // 不影响主流程，继续执行
      }
    }

    return {
      success: true,
      data: userData,
      message: '初始化成功'
    }
  } catch (err) {
    console.error('初始化用户失败', err)
    return {
      success: false,
      message: '初始化失败',
      error: err
    }
  }
}
