// app.js
App({
  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloudbase-1gdysknn57ce9b9f',
        traceUser: true
      })
    }

    // 检查登录状态
    this.checkLoginStatus()

    // 记录开始时间
    this.sessionStartTime = Date.now()
  },

  onShow() {
    // 小程序从后台进入前台
    this.sessionStartTime = Date.now()
  },

  onHide() {
    // 小程序从前台进入后台，记录本次会话时长
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
   */
  async recordSession() {
    if (!this.sessionStartTime) return

    const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000) // 秒

    // 只记录超过5秒的会话
    if (duration < 5) return

    try {
      await wx.cloud.callFunction({
        name: 'user-activity',
        data: {
          action: 'recordSession',
          duration: duration
        }
      })
      console.log('会话记录成功，时长：', duration, '秒')
    } catch (err) {
      console.error('记录会话失败', err)
    }
  },

  // 检查登录状态
  // 安全修复 #10: 添加客户端缓存，减少云函数调用频率
  async checkLoginStatus() {
    try {
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
        console.log('使用缓存的用户信息，有效期至:', new Date(lastInitTime + this.globalData.INIT_CACHE_DURATION))
        return
      }

      // 缓存过期或不存在，调用云函数
      console.log('缓存过期或不存在，重新获取用户信息')
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
        console.log('用户信息已更新并缓存')
      }
    } catch (err) {
      console.error('检查登录状态失败', err)
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
