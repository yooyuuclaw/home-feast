// pages/admin/user-manage/user-manage.js
const { getAllRoles, getRoleName } = require('../../../utils/roles.js')

Page({
  data: {
    users: [],
    displayUsers: [], // 用于显示的排序后的用户列表
    loading: true,
    allRoles: [],
    roleNames: [],
    sortOptions: ['访问次数', '总在线时长', '最后访问时间'],
    currentSortIndex: 0,
    currentSortLabel: '访问次数'
  },

  onLoad() {
    // 加载角色列表
    const roles = getAllRoles()
    this.setData({
      allRoles: roles,
      roleNames: roles.map(r => r.label)
    })
    this.loadUsers()
  },

  async loadUsers() {
    try {
      this.setData({ loading: true })

      // 获取用户列表
      const userRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getAllUsers'
        }
      })

      // 获取用户活动统计
      const statsRes = await wx.cloud.callFunction({
        name: 'user-activity',
        data: {
          action: 'getStatistics'
        }
      })

      if (userRes.result.success) {
        // 合并用户数据和统计数据
        // 修复：使用 _id 而不是 _openid 来匹配，因为统计数据中已移除 _openid
        const statsMap = {}
        if (statsRes.result.success) {
          statsRes.result.data.forEach(stat => {
            statsMap[stat._id] = stat
          })
        }

        const users = userRes.result.data.map(user => ({
          ...user,
          roleName: getRoleName(user.role),
          visitCount: statsMap[user._id]?.sessionCount || 0,
          totalDuration: statsMap[user._id]?.totalDuration || 0,
          lastOnlineTime: statsMap[user._id]?.lastOnlineTime || 0
        }))

        console.log('用户数据:', users)
        console.log('统计数据:', statsRes.result.data)

        this.setData({
          users: users,
          loading: false
        })

        // 应用当前排序
        this.sortUsers(this.data.currentSortIndex)
      }
    } catch (err) {
      console.error('加载用户失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /**
   * 选择排序方式
   */
  selectSort() {
    wx.showActionSheet({
      itemList: this.data.sortOptions,
      success: (res) => {
        this.sortUsers(res.tapIndex)
      }
    })
  },

  /**
   * 排序用户列表
   */
  sortUsers(sortIndex) {
    const users = [...this.data.users]

    switch(sortIndex) {
      case 0: // 访问次数
        users.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
        break
      case 1: // 总在线时长
        users.sort((a, b) => (b.totalDuration || 0) - (a.totalDuration || 0))
        break
      case 2: // 最后访问时间
        users.sort((a, b) => (b.lastOnlineTime || 0) - (a.lastOnlineTime || 0))
        break
    }

    this.setData({
      displayUsers: users,
      currentSortIndex: sortIndex,
      currentSortLabel: this.data.sortOptions[sortIndex]
    })
  },

  /**
   * 修改用户角色
   */
  async changeRole(e) {
    const { id, role } = e.currentTarget.dataset

    // 获取当前角色在列表中的索引
    const currentIndex = this.data.allRoles.findIndex(r => r.value === role)

    wx.showActionSheet({
      itemList: this.data.roleNames,
      success: async (res) => {
        const selectedRole = this.data.allRoles[res.tapIndex]

        if (selectedRole.value === role) {
          // 未改变
          return
        }

        try {
          wx.showLoading({ title: '更新中...' })

          const result = await wx.cloud.callFunction({
            name: 'user',
            data: {
              action: 'updateRole',
              userId: id,
              role: selectedRole.value
            }
          })

          wx.hideLoading()

          if (result.result.success) {
            wx.showToast({ title: '更新成功', icon: 'success' })
            this.loadUsers()
          } else {
            // 显示服务端返回的具体错误信息
            wx.showModal({
              title: '操作失败',
              content: result.result.message || '更新角色失败',
              showCancel: false,
              confirmText: '知道了'
            })
          }
        } catch (err) {
          console.error('更新角色失败', err)
          wx.hideLoading()
          wx.showModal({
            title: '操作失败',
            content: '网络错误，请重试',
            showCancel: false,
            confirmText: '知道了'
          })
        }
      }
    })
  },

  // 保留旧的方法名，但调用新方法
  toggleRole(e) {
    this.changeRole(e)
  }
})
