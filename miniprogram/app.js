// app.js
App({
  onLaunch() {
    console.log('[App] onLaunch - 小程序启动')

    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloudbase-1gdysknn57ce9b9f',
        traceUser: true
      })
    }

    // 加载购物车数据
    this.loadCart()

    // 检查登录状态
    this.checkLoginStatus()

    // 记录开始时间
    this.sessionStartTime = Date.now()
    console.log('[App] 会话开始时间已记录:', new Date(this.sessionStartTime))

    // 启动会话定期记录
    this.startSessionRecording()
  },

  onShow() {
    console.log('[App] onShow - 小程序进入前台')

    // 小程序从后台进入前台
    this.sessionStartTime = Date.now()
    console.log('[App] 会话开始时间已更新:', new Date(this.sessionStartTime))

    // 重新启动会话定期记录
    this.startSessionRecording()
  },

  onHide() {
    console.log('[App] onHide - 小程序进入后台')

    // 小程序从前台进入后台，记录本次会话时长
    this.recordSession()

    // 停止会话定期记录
    this.stopSessionRecording()
  },

  onUnload() {
    // 小程序被销毁时也记录会话
    this.recordSession()
  },

  onError(error) {
    // 发生错误时也尝试记录会话
    console.error('小程序错误:', error)
    this.recordSession()
  },

  // 全局数据
  globalData: {
    userInfo: null,
    isAdmin: false,
    cart: [], // 购物车数据
    selectedGathering: null, // 当前选中的聚餐日
    lastInitTime: null, // 上次初始化用户信息的时间
    INIT_CACHE_DURATION: 30 * 60 * 1000 // 30分钟缓存时间
  },

  /**
   * 记录会话时长
   * 改进：确保会话能够被记录，即使用户不切换应用
   */
  async recordSession() {
    console.log('[App] recordSession 被调用')

    if (!this.sessionStartTime) {
      console.log('[App] 会话开始时间未设置，跳过记录')
      return
    }

    const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000) // 秒
    console.log('[App] 计算会话时长:', duration, '秒')

    // 只记录超过3秒的会话（降低阈值，提高记录频率）
    if (duration < 3) {
      console.log('[App] 会话时长不足3秒，跳过记录')
      return
    }

    try {
      console.log('[App] 准备调用 user-activity 云函数记录会话...')
      const res = await wx.cloud.callFunction({
        name: 'user-activity',
        data: {
          action: 'recordSession',
          duration: duration
        }
      })
      console.log('[App] 会话记录成功，时长：', duration, '秒', res)

      // 重置会话开始时间，避免重复记录
      this.sessionStartTime = Date.now()
    } catch (err) {
      console.error('[App] 记录会话失败:', err)
    }
  },

  /**
   * 定期记录会话（每5分钟自动记录一次）
   * 这样可以捕获长时间停留但不切换应用的用户
   */
  startSessionRecording() {
    // 如果已有定时器，先清除
    if (this.sessionTimer) {
      console.log('[App] 清除旧的会话记录定时器')
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }

    console.log('[App] 启动会话定期记录定时器（每5分钟）')

    // 每5分钟记录一次会话
    this.sessionTimer = setInterval(() => {
      console.log('[App] 定时器触发 - 检查是否需要记录会话')
      if (this.sessionStartTime) {
        const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000)
        console.log('[App] 当前会话时长:', duration, '秒')
        if (duration >= 30) { // 如果已经超过30秒，记录会话
          console.log('[App] 会话时长超过30秒，触发自动记录')
          this.recordSession()
        }
      }
    }, 5 * 60 * 1000) // 5分钟
  },

  /**
   * 停止会话记录定时器
   */
  stopSessionRecording() {
    if (this.sessionTimer) {
      console.log('[App] 停止会话定期记录定时器')
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
  },

  // 检查登录状态
  // 安全修复 #10: 添加客户端缓存，减少云函数调用频率
  async checkLoginStatus() {
    try {
      console.log('[App] checkLoginStatus - 开始检查登录状态')

      // 检查缓存是否有效
      const now = Date.now()
      const cachedUserInfo = wx.getStorageSync('userInfo')
      const lastInitTime = wx.getStorageSync('lastInitTime')

      if (cachedUserInfo && lastInitTime &&
          (now - lastInitTime < this.globalData.INIT_CACHE_DURATION)) {
        // 使用缓存
        this.globalData.userInfo = cachedUserInfo
        this.globalData.isAdmin = cachedUserInfo.role === 'admin'
        this.globalData.lastInitTime = lastInitTime
        console.log('[App] 使用缓存的用户信息，有效期至:', new Date(lastInitTime + this.globalData.INIT_CACHE_DURATION))

        // 即使使用缓存，也要记录启动会话
        await this.recordLaunchSession()
        return
      }

      // 缓存过期或不存在，调用云函数
      console.log('[App] 缓存过期或不存在，重新获取用户信息')
      const userProfile = await this.getUserProfile()

      // 调用云函数初始化用户，传入昵称和头像
      const res = await wx.cloud.callFunction({
        name: 'initUser',
        data: {
          nickname: userProfile.nickName,
          avatar: userProfile.avatarUrl
        }
      })

      if (res.result.success) {
        this.globalData.userInfo = res.result.data
        this.globalData.isAdmin = res.result.data.role === 'admin'
        this.globalData.lastInitTime = now

        // 更新缓存
        wx.setStorageSync('userInfo', res.result.data)
        wx.setStorageSync('lastInitTime', now)
        console.log('[App] 用户信息已更新并缓存')
      }
    } catch (err) {
      console.error('[App] 检查登录状态失败', err)
    }
  },

  /**
   * 记录启动会话（每次打开小程序时调用）
   */
  async recordLaunchSession() {
    try {
      console.log('[App] 记录启动会话...')
      const res = await wx.cloud.callFunction({
        name: 'user-activity',
        data: {
          action: 'recordSession',
          duration: 1 // 记录1秒，表示这是启动记录
        }
      })
      console.log('[App] 启动会话记录成功', res)
    } catch (err) {
      console.error('[App] 记录启动会话失败', err)
    }
  },

  // 获取用户信息
  async getUserProfile() {
    try {
      // 尝试从缓存获取
      const cachedProfile = wx.getStorageSync('userProfile')
      if (cachedProfile) {
        return cachedProfile
      }

      // 如果没有缓存，返回默认值（等待用户授权）
      return {
        nickName: '昵称',
        avatarUrl: ''
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
      return {
        nickName: '昵称',
        avatarUrl: ''
      }
    }
  },

  // 更新用户信息（在首页调用）
  async updateUserInfo(userInfo) {
    try {
      // 保存到缓存
      wx.setStorageSync('userProfile', userInfo)

      // 调用云函数更新
      const res = await wx.cloud.callFunction({
        name: 'initUser',
        data: {
          nickname: userInfo.nickName,
          avatar: userInfo.avatarUrl
        }
      })

      if (res.result.success) {
        this.globalData.userInfo = res.result.data
        this.globalData.isAdmin = res.result.data.role === 'admin'
      }

      return res.result
    } catch (err) {
      console.error('更新用户信息失败', err)
      throw err
    }
  },

  // 获取购物车数据
  getCart() {
    return this.globalData.cart
  },

  // 添加到购物车
  addToCart(dish) {
    const cart = this.globalData.cart
    const index = cart.findIndex(item => item._id === dish._id)

    if (index > -1) {
      cart[index].count += dish.count || 1
    } else {
      cart.push({
        ...dish,
        count: dish.count || 1
      })
    }

    this.globalData.cart = cart
    this.saveCart()
  },

  // 更新购物车商品数量
  updateCartItem(dishId, count) {
    const cart = this.globalData.cart
    const index = cart.findIndex(item => item._id === dishId)

    if (index > -1) {
      if (count <= 0) {
        cart.splice(index, 1)
      } else {
        cart[index].count = count
      }
    }

    this.globalData.cart = cart
    this.saveCart()
  },

  // 清空购物车
  clearCart() {
    this.globalData.cart = []
    this.saveCart()
  },

  // 保存购物车到本地存储
  saveCart() {
    wx.setStorageSync('cart', this.globalData.cart)
  },

  // 从本地存储加载购物车
  loadCart() {
    const cart = wx.getStorageSync('cart')
    if (cart) {
      this.globalData.cart = cart
    }
  },

  // 设置选中的聚餐日
  setSelectedGathering(gathering) {
    this.globalData.selectedGathering = gathering
    wx.setStorageSync('selectedGathering', gathering)
  },

  // 获取选中的聚餐日
  getSelectedGathering() {
    if (!this.globalData.selectedGathering) {
      const cached = wx.getStorageSync('selectedGathering')
      if (cached) {
        this.globalData.selectedGathering = cached
      }
    }
    return this.globalData.selectedGathering
  },

  // 清除选中的聚餐日
  clearSelectedGathering() {
    this.globalData.selectedGathering = null
    wx.removeStorageSync('selectedGathering')
  }
})
