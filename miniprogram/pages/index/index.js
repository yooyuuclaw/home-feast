// pages/index/index.js
const app = getApp()
const { getRoleName } = require('../../utils/roles.js')

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    roleName: ''
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    // 每次显示页面时刷新用户信息
    this.loadUserInfo()
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      wx.showLoading({ title: '加载中...' })

      // 尝试从缓存获取用户信息
      const cachedProfile = wx.getStorageSync('userProfile')

      const res = await wx.cloud.callFunction({
        name: 'initUser',
        data: cachedProfile ? {
          nickname: cachedProfile.nickName,
          avatar: cachedProfile.avatarUrl
        } : {}
      })

      if (res.result.success) {
        const userInfo = res.result.data
        this.setData({
          userInfo: userInfo,
          isAdmin: userInfo.role === 'admin',
          roleName: getRoleName(userInfo.role)
        })

        // 更新全局数据
        app.globalData.userInfo = userInfo
        app.globalData.isAdmin = userInfo.role === 'admin'
      }

      wx.hideLoading()
    } catch (err) {
      console.error('加载用户信息失败', err)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 选择头像
   */
  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail

    try {
      wx.showLoading({ title: '上传中...' })

      // 上传头像到云存储
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl
      })

      // 更新用户信息
      const res = await wx.cloud.callFunction({
        name: 'initUser',
        data: {
          nickname: this.data.userInfo.nickname,
          avatar: uploadRes.fileID
        }
      })

      if (res.result.success) {
        this.setData({
          'userInfo.avatar': uploadRes.fileID
        })

        // 更新缓存
        const cachedProfile = wx.getStorageSync('userProfile') || {}
        cachedProfile.avatarUrl = uploadRes.fileID
        wx.setStorageSync('userProfile', cachedProfile)

        wx.hideLoading()
        wx.showToast({
          title: '头像更新成功',
          icon: 'success'
        })
      }
    } catch (err) {
      console.error('更新头像失败', err)
      wx.hideLoading()
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },

  /**
   * 昵称输入完成
   */
  async onNicknameBlur(e) {
    const nickname = e.detail.value

    if (!nickname || nickname === this.data.userInfo.nickname) {
      return
    }

    try {
      wx.showLoading({ title: '更新中...' })

      const res = await wx.cloud.callFunction({
        name: 'initUser',
        data: {
          nickname: nickname,
          avatar: this.data.userInfo.avatar
        }
      })

      if (res.result.success) {
        this.setData({
          'userInfo.nickname': nickname
        })

        // 更新缓存
        const cachedProfile = wx.getStorageSync('userProfile') || {}
        cachedProfile.nickName = nickname
        wx.setStorageSync('userProfile', cachedProfile)

        wx.hideLoading()
        wx.showToast({
          title: '昵称更新成功',
          icon: 'success'
        })
      }
    } catch (err) {
      console.error('更新昵称失败', err)
      wx.hideLoading()
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },

  /**
   * 跳转到菜单页面
   */
  goToMenu() {
    wx.navigateTo({
      url: '/pages/menu/menu'
    })
  },

  /**
   * 跳转到订单历史页面
   */
  goToOrderHistory() {
    wx.navigateTo({
      url: '/pages/order-history/order-history'
    })
  },

  /**
   * 跳转到管理后台
   */
  goToAdmin() {
    if (!this.data.isAdmin) {
      wx.showToast({
        title: '无管理员权限',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: '/pages/admin/admin'
    })
  }
})
