// pages/admin/admin.js
const app = getApp()

Page({
  data: {
    userInfo: null
  },

  onLoad() {
    this.verifyAdminPermission()
  },

  /**
   * 验证管理员权限（服务端验证）
   */
  async verifyAdminPermission() {
    try {
      // 调用云函数获取真实的用户信息（服务端验证）
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: { action: 'getUserInfo' }
      })

      if (res.result.success && res.result.data.role === 'admin') {
        // 确认是管理员，加载页面数据
        this.loadUserInfo()
      } else {
        // 不是管理员，返回上一页
        wx.showModal({
          title: '权限不足',
          content: '您没有管理员权限',
          showCancel: false,
          success: () => {
            wx.navigateBack({
              fail: () => {
                // 如果返回失败（可能是直接进入的），跳转到首页
                wx.switchTab({
                  url: '/pages/index/index'
                })
              }
            })
          }
        })
      }
    } catch (err) {
      console.error('验证管理员权限失败', err)
      wx.showModal({
        title: '验证失败',
        content: '无法验证权限，请重试',
        showCancel: false,
        success: () => {
          wx.navigateBack({
            fail: () => {
              wx.switchTab({
                url: '/pages/index/index'
              })
            }
          })
        }
      })
    }
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const userInfo = app.globalData.userInfo

    this.setData({
      userInfo: userInfo
    })
  },

  /**
   * 跳转到订单管理
   */
  goToOrderManage() {
    wx.navigateTo({
      url: '/packageAdmin/pages/order-manage/order-manage'
    })
  },

  /**
   * 跳转到聚餐日管理
   */
  goToGatheringManage() {
    wx.navigateTo({
      url: '/packageAdmin/pages/gathering-manage/gathering-manage'
    })
  },

  /**
   * 跳转到菜单管理
   */
  goToMenuManage() {
    wx.navigateTo({
      url: '/packageAdmin/pages/menu-manage/menu-manage'
    })
  },

  /**
   * 跳转到用户管理
   */
  goToUserManage() {
    wx.navigateTo({
      url: '/packageAdmin/pages/user-manage/user-manage'
    })
  },

  /**
   * 跳转到数据统计
   */
  goToStatistics() {
    wx.navigateTo({
      url: '/packageAdmin/pages/statistics/statistics'
    })
  },

  /**
   * 跳转到备份管理
   */
  goToBackupManage() {
    wx.navigateTo({
      url: '/packageAdmin/pages/backup-manage/backup-manage'
    })
  },

  /**
   * 跳转到审计日志
   */
  goToAuditLogs() {
    wx.navigateTo({
      url: '/packageAdmin/pages/audit-logs/audit-logs'
    })
  }
})
