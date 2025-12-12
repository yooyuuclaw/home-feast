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
    currentSortLabel: '访问次数',

    // 分页相关
    currentPage: 1,
    pageSize: 100,
    totalUsers: 0,
    totalPages: 0,

    // 排序字段映射
    sortFieldMap: ['visitCount', 'totalDuration', 'lastOnlineTime']
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

      // 获取当前排序字段
      const sortBy = this.data.sortFieldMap[this.data.currentSortIndex]

      // 获取用户列表（带分页和排序）
      const userRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getAllUsers',
          page: this.data.currentPage,
          pageSize: this.data.pageSize,
          sortBy: sortBy
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
        console.log('分页信息:', {
          total: userRes.result.total,
          page: userRes.result.page,
          totalPages: userRes.result.totalPages,
          sortBy: userRes.result.sortBy
        })

        this.setData({
          users: users,
          displayUsers: users, // 直接使用服务端排序好的数据
          totalUsers: userRes.result.total,
          totalPages: userRes.result.totalPages,
          currentPage: userRes.result.page,
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
   * 上一页
   */
  prevPage() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      })
      this.loadUsers()
    }
  },

  /**
   * 下一页
   */
  nextPage() {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1
      })
      this.loadUsers()
    }
  },

  /**
   * 跳转到指定页
   */
  goToPage() {
    wx.showModal({
      title: '跳转到页面',
      content: `请输入页码（1-${this.data.totalPages}）`,
      editable: true,
      placeholderText: '输入页码',
      success: (res) => {
        if (res.confirm && res.content) {
          const page = parseInt(res.content)
          if (page >= 1 && page <= this.data.totalPages) {
            this.setData({
              currentPage: page
            })
            this.loadUsers()
          } else {
            wx.showToast({
              title: '页码超出范围',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  /**
   * 选择排序方式
   */
  selectSort() {
    wx.showActionSheet({
      itemList: this.data.sortOptions,
      success: (res) => {
        // 切换排序方式时，重置到第一页
        this.setData({
          currentSortIndex: res.tapIndex,
          currentSortLabel: this.data.sortOptions[res.tapIndex],
          currentPage: 1
        })
        this.loadUsers()
      }
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
