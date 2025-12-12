// pages/admin/user-manage/user-manage.js
const { getAllRoles, getRoleName } = require('../../../utils/roles.js')

Page({
  data: {
    allUsers: [], // 所有用户数据（已合并统计数据）
    displayUsers: [], // 当前页显示的用户
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
    totalPages: 0
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

      // 获取所有用户列表
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
        const statsMap = {}
        if (statsRes.result.success) {
          statsRes.result.data.forEach(stat => {
            statsMap[stat._id] = stat
          })
        }

        const allUsers = userRes.result.data.map(user => ({
          ...user,
          roleName: getRoleName(user.role),
          visitCount: statsMap[user._id]?.sessionCount || 0,
          totalDuration: statsMap[user._id]?.totalDuration || 0,
          lastOnlineTime: statsMap[user._id]?.lastOnlineTime || 0
        }))

        console.log('所有用户数据:', allUsers)
        console.log('统计数据:', statsRes.result.data)

        this.setData({
          allUsers: allUsers,
          totalUsers: userRes.result.total,
          loading: false
        })

        // 应用排序和分页
        this.applyFilterAndPagination()
      }
    } catch (err) {
      console.error('加载用户失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /**
   * 应用排序和分页
   */
  applyFilterAndPagination() {
    const { allUsers, currentSortIndex, currentPage, pageSize } = this.data

    // 排序
    const sortedUsers = [...allUsers]
    switch(currentSortIndex) {
      case 0: // 访问次数
        sortedUsers.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
        break
      case 1: // 总在线时长
        sortedUsers.sort((a, b) => (b.totalDuration || 0) - (a.totalDuration || 0))
        break
      case 2: // 最后访问时间
        sortedUsers.sort((a, b) => (b.lastOnlineTime || 0) - (a.lastOnlineTime || 0))
        break
    }

    // 计算总页数
    const totalPages = Math.ceil(sortedUsers.length / pageSize)

    // 分页
    const skip = (currentPage - 1) * pageSize
    const displayUsers = sortedUsers.slice(skip, skip + pageSize)

    this.setData({
      displayUsers: displayUsers,
      totalPages: totalPages
    })

    console.log('排序后分页数据:', {
      currentPage,
      totalPages,
      displayCount: displayUsers.length,
      sortBy: this.data.sortOptions[currentSortIndex]
    })
  },

  /**
   * 上一页
   */
  prevPage() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      })
      this.applyFilterAndPagination()
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
      this.applyFilterAndPagination()
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
            this.applyFilterAndPagination()
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
        this.applyFilterAndPagination()
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
