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
  },

  // 全局数据
  globalData: {
    userInfo: null,
    isAdmin: false,
    cart: [] // 购物车数据
  },

  // 检查登录状态
  async checkLoginStatus() {
    try {
      // 先获取微信用户信息
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
        nickName: '微信用户',
        avatarUrl: ''
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
      return {
        nickName: '微信用户',
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
  }
})
