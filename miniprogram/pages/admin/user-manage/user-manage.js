// pages/admin/user-manage/user-manage.js
const { getAllRoles, getRoleName } = require('../../../utils/roles.js')

Page({
  data: {
    users: [],
    loading: true,
    allRoles: [],
    roleNames: []
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

      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getAllUsers'
        }
      })

      if (res.result.success) {
        // 为每个用户添加角色显示名称
        const users = res.result.data.map(user => ({
          ...user,
          roleName: getRoleName(user.role)
        }))

        this.setData({
          users: users,
          loading: false
        })
      }
    } catch (err) {
      console.error('加载用户失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
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
          }
        } catch (err) {
          console.error('更新角色失败', err)
          wx.hideLoading()
          wx.showToast({ title: '更新失败', icon: 'none' })
        }
      }
    })
  },

  // 保留旧的方法名，但调用新方法
  toggleRole(e) {
    this.changeRole(e)
  }
})
