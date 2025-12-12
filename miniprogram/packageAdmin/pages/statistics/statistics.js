// pages/admin/statistics/statistics.js
const { getRoleName } = require('../../../utils/roles.js')

Page({
  data: {
    orderStats: { total: 0, pending: 0, confirmed: 0, completed: 0 },
    dishStats: [],
    userStats: [],
    loading: true,
    currentTab: 0, // 当前选中的标签：0-订单统计，1-用户活动，2-热门菜品
    tabs: ['订单统计', '用户活动', '热门菜品'],
    sortBy: 'sessionCount', // 当前排序字段
    sortIndex: 2, // 当前排序索引（默认是访问次数）
    sortOptions: [
      { value: 'createTime', label: '首次上线' },
      { value: 'lastOnlineTime', label: '最后上线' },
      { value: 'sessionCount', label: '访问次数' },
      { value: 'totalDuration', label: '总在线时长' },
      { value: 'avgDuration', label: '平均时长' }
    ],

    // 分页相关
    currentPage: 1,
    pageSize: 100,
    totalUsers: 0,
    totalPages: 0
  },

  onLoad() {
    this.loadStatistics()
  },

  /**
   * 切换标签
   */
  onTabChange(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentTab: index })
  },

  async loadStatistics() {
    try {
      this.setData({ loading: true })

      const [orderRes, dishRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'statistics',
          data: { action: 'getOrderStatistics' }
        }),
        wx.cloud.callFunction({
          name: 'statistics',
          data: { action: 'getDishStatistics' }
        })
      ])

      this.setData({
        orderStats: orderRes.result.data,
        dishStats: dishRes.result.data.slice(0, 10),
        loading: false
      })

      // 加载用户活动数据（支持分页）
      await this.loadUserActivity()
    } catch (err) {
      console.error('加载统计失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /**
   * 加载用户活动数据（支持分页和服务端排序）
   */
  async loadUserActivity() {
    try {
      const userRes = await wx.cloud.callFunction({
        name: 'user-activity',
        data: {
          action: 'getStatistics',
          page: this.data.currentPage,
          pageSize: this.data.pageSize,
          sortBy: this.data.sortBy
        }
      })

      if (userRes.result.success) {
        // 预处理用户统计数据
        const processedUserStats = (userRes.result.data || []).map(user => ({
          ...user,
          roleName: getRoleName(user.role),
          // 预格式化时间
          createTimeFormatted: this.formatTime(user.createTime),
          lastOnlineTimeFormatted: this.formatTime(user.lastOnlineTime),
          // 预格式化时长
          totalDurationFormatted: this.formatDuration(user.totalDuration),
          avgDurationFormatted: this.formatDuration(user.avgDuration)
        }))

        this.setData({
          userStats: processedUserStats,
          totalUsers: userRes.result.total,
          totalPages: userRes.result.totalPages,
          currentPage: userRes.result.page
        })
      }
    } catch (err) {
      console.error('加载用户活动失败', err)
      wx.showToast({ title: '加载用户活动失败', icon: 'none' })
    }
  },

  /**
   * 切换排序方式
   */
  onSortChange(e) {
    const sortIndex = e.detail.value
    const selectedOption = this.data.sortOptions[sortIndex]

    this.setData({
      sortIndex: sortIndex,
      sortBy: selectedOption.value,
      currentPage: 1 // 切换排序时重置到第一页
    })
    this.loadUserActivity()
  },

  /**
   * 上一页
   */
  prevPage() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      })
      this.loadUserActivity()
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
      this.loadUserActivity()
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
            this.loadUserActivity()
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
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  /**
   * 格式化时长（秒 → 小时分钟）
   */
  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0分钟'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    } else {
      return `${minutes}分钟`
    }
  }
})
