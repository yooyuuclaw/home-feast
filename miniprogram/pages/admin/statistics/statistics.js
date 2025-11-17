// pages/admin/statistics/statistics.js
const { getRoleName } = require('../../../utils/roles.js')

Page({
  data: {
    orderStats: { total: 0, pending: 0, confirmed: 0, completed: 0 },
    dishStats: [],
    userStats: [],
    originalUserStats: [], // 保存原始用户数据用于排序
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
    ]
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

      const [orderRes, dishRes, userRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'statistics',
          data: { action: 'getOrderStatistics' }
        }),
        wx.cloud.callFunction({
          name: 'statistics',
          data: { action: 'getDishStatistics' }
        }),
        wx.cloud.callFunction({
          name: 'user-activity',
          data: { action: 'getStatistics' }
        })
      ])

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
        orderStats: orderRes.result.data,
        dishStats: dishRes.result.data.slice(0, 10),
        userStats: processedUserStats,
        originalUserStats: processedUserStats, // 保存原始数据
        loading: false
      })

      // 应用默认排序
      this.sortUserStats()
    } catch (err) {
      console.error('加载统计失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /**
   * 排序用户统计
   */
  sortUserStats() {
    const { originalUserStats, sortBy } = this.data

    const sorted = [...originalUserStats].sort((a, b) => {
      const aVal = a[sortBy] || 0
      const bVal = b[sortBy] || 0
      return bVal - aVal // 降序排列
    })

    this.setData({ userStats: sorted })
  },

  /**
   * 切换排序方式
   */
  onSortChange(e) {
    const sortIndex = e.detail.value
    const selectedOption = this.data.sortOptions[sortIndex]

    this.setData({
      sortIndex: sortIndex,
      sortBy: selectedOption.value
    })
    this.sortUserStats()
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
