// pages/order-history/order-history.js
const { ORDER_STATUS_TEXT } = require('../../utils/constants.js')
const { formatTime } = require('../../utils/util.js')
const { hasPermission } = require('../../utils/roles.js')

Page({
  data: {
    orders: [],
    groupedOrders: [], // 按聚餐日分组的订单
    loading: true,
    currentUserId: '', // 当前用户的 userId（改用 userId 而不是 openid）
    userRole: '', // 用户角色
    canViewOrders: false // 是否有查看订单权限
  },

  onLoad() {
    this.loadOrders()
  },

  /**
   * 加载订单列表
   */
  async loadOrders() {
    try {
      this.setData({ loading: true })

      // 先获取用户信息检查权限
      const userRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getUserInfo'
        }
      })

      if (!userRes.result.success) {
        throw new Error('获取用户信息失败')
      }

      const userInfo = userRes.result.data
      const userRole = userInfo.role
      const canViewOrders = hasPermission(userRole, 'canViewOrders')

      this.setData({
        userRole: userRole,
        canViewOrders: canViewOrders
      })

      // 如果没有查看订单权限，直接返回
      if (!canViewOrders) {
        this.setData({
          orders: [],
          groupedOrders: [],
          loading: false
        })
        return
      }

      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getUserOrders'
        }
      })

      if (res.result.success) {
        // 获取当前用户的 userId（改用 userId）
        const currentUserId = res.result.currentUserId || ''

        // 格式化订单数据
        const orders = res.result.data.map(order => ({
          ...order,
          createTimeFormatted: this.formatTime(order.createTime),
          statusText: this.getStatusText(order.status),
          isMyOrder: order.userId === currentUserId // 改用 userId 比较
        }))

        // 按聚餐日分组
        const groupedOrders = this.groupOrdersByGatheringDay(orders)

        this.setData({
          orders: orders,
          groupedOrders: groupedOrders,
          currentUserId: currentUserId,  // 改用 userId
          loading: false
        })
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      console.error('加载订单失败', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 按聚餐日分组订单
   */
  groupOrdersByGatheringDay(orders) {
    // 创建一个 Map 来存储分组
    const groupMap = new Map()

    orders.forEach(order => {
      const key = order.gatheringDayId || 'no-gathering-day'

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          gatheringDayId: order.gatheringDayId || '',
          gatheringDayTheme: order.gatheringDayTheme || '未指定聚餐日',
          gatheringDayDate: order.gatheringDayDate || '',
          orders: []
        })
      }

      groupMap.get(key).orders.push(order)
    })

    // 将 Map 转换为数组，并按日期排序
    const groups = Array.from(groupMap.values())

    // 按聚餐日日期倒序排序（最新的在前）
    groups.sort((a, b) => {
      if (!a.gatheringDayDate) return 1
      if (!b.gatheringDayDate) return -1
      return b.gatheringDayDate.localeCompare(a.gatheringDayDate)
    })

    // 每个分组内的订单按下单时间倒序排序（最新的在前）
    groups.forEach(group => {
      group.orders.sort((a, b) => {
        return b.createTime - a.createTime
      })

      // 处理日期显示信息
      if (group.gatheringDayDate) {
        const dateInfo = this.getDateDisplayInfo(group.gatheringDayDate, group.gatheringDayTheme)
        group.dateLabel = dateInfo.dateLabel           // 昨天/今天/明天/后天
        group.dateWithWeekday = dateInfo.dateWithWeekday // 日期 + 周几
        group.displayTitle = dateInfo.displayTitle      // 最终显示标题
        group.displaySubtitle = dateInfo.displaySubtitle // 最终显示副标题
      }
    })

    return groups
  },

  /**
   * 获取日期显示信息
   */
  getDateDisplayInfo(dateStr, theme) {
    // 获取今天的日期
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = this.formatDate(today)

    // 昨天
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = this.formatDate(yesterday)

    // 明天
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = this.formatDate(tomorrow)

    // 后天
    const dayAfterTomorrow = new Date(today)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
    const dayAfterTomorrowStr = this.formatDate(dayAfterTomorrow)

    // 获取周几
    const weekday = this.getWeekday(dateStr)
    const dateWithWeekday = `${dateStr} ${weekday}`

    let dateLabel = '' // 昨天/今天/明天/后天
    let displayTitle = ''
    let displaySubtitle = dateWithWeekday

    // 判断是否为快捷选项（今天/明天/后天等）
    const isQuickOption = theme === '今天' || theme === '明天' || theme === '后天' || theme === '昨天' || theme === '未指定聚餐日'

    // 判断是昨天、今天、明天还是后天
    if (dateStr === yesterdayStr) {
      dateLabel = '昨天'
      // 如果是快捷选项，不显示主题；否则显示"昨天 · 主题"
      displayTitle = isQuickOption ? '昨天' : `昨天 · ${theme}`
    } else if (dateStr === todayStr) {
      dateLabel = '今天'
      displayTitle = isQuickOption ? '今天' : `今天 · ${theme}`
    } else if (dateStr === tomorrowStr) {
      dateLabel = '明天'
      displayTitle = isQuickOption ? '明天' : `明天 · ${theme}`
    } else if (dateStr === dayAfterTomorrowStr) {
      dateLabel = '后天'
      displayTitle = isQuickOption ? '后天' : `后天 · ${theme}`
    } else {
      // 不是昨天、今天、明天、后天，只显示聚餐日信息
      dateLabel = ''
      displayTitle = isQuickOption ? dateWithWeekday : theme
    }

    return {
      dateLabel,
      dateWithWeekday,
      displayTitle,
      displaySubtitle
    }
  },

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  /**
   * 获取周几
   */
  getWeekday(dateStr) {
    const date = new Date(dateStr)
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[date.getDay()]
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return formatTime(date)
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    return ORDER_STATUS_TEXT[status] || status
  },

  /**
   * 删除订单
   */
  async deleteOrder(e) {
    const { id } = e.currentTarget.dataset

    try {
      // 确认删除
      await wx.showModal({
        title: '确认删除',
        content: '确定要删除这个订单吗？',
        confirmText: '删除',
        confirmColor: '#fa5151'
      })

      wx.showLoading({ title: '删除中...' })

      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'deleteOrder',
          id: id
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        // 重新加载订单列表
        this.loadOrders()
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      if (err.errMsg && err.errMsg.includes('cancel')) {
        // 用户取消删除
        return
      }
      console.error('删除订单失败', err)
      wx.hideLoading()
      wx.showToast({
        title: err.message || '删除失败',
        icon: 'none'
      })
    }
  }
})
