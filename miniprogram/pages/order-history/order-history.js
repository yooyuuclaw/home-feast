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

        // 获取今天的日期，用于判断订单是否为过去
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = this.formatDate(today)

        // 格式化订单数据
        const orders = res.result.data.map(order => ({
          ...order,
          createTimeFormatted: this.formatTime(order.createTime),
          statusText: this.getStatusText(order.status),
          isMyOrder: order.userId === currentUserId, // 改用 userId 比较
          isPastOrder: order.gatheringDayDate && order.gatheringDayDate < todayStr // 判断是否为过去的订单
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
   * 修复：使用 gatheringDayDate 作为分组键，而不是 gatheringDayId
   * 原因：快速聚餐日（今天/明天/后天）使用固定ID（quick-today等），
   *       会导致不同日期的订单被错误分到同一组
   */
  groupOrdersByGatheringDay(orders) {
    // 创建一个 Map 来存储分组
    const groupMap = new Map()

    orders.forEach(order => {
      // 使用日期作为分组键，确保不同日期的订单分到不同组
      const key = order.gatheringDayDate || 'no-gathering-day'

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

        // 添加时间状态用于样式控制
        group.timeStatus = this.getTimeStatus(group.gatheringDayDate)
      }
    })

    return groups
  },

  /**
   * 获取日期显示信息（优化版）
   * 主标题：前天/昨天/今天/明天/后天 或 N天前/N天后，如果有聚餐日主题则追加显示
   * 副标题：日期 + 星期
   */
  getDateDisplayInfo(dateStr, theme) {
    // 获取今天的日期
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = this.formatDate(today)

    // 前天
    const dayBeforeYesterday = new Date(today)
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)
    const dayBeforeYesterdayStr = this.formatDate(dayBeforeYesterday)

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
    const displaySubtitle = `${dateStr} ${weekday}`

    let displayTitle = ''

    // 判断是否为快捷选项（不需要显示聚餐日主题）
    const isQuickOption = theme === '今天' || theme === '明天' || theme === '后天' ||
                          theme === '昨天' || theme === '前天' || theme === '未指定聚餐日'

    // 第一步：判断日期，生成时间描述
    if (dateStr === dayBeforeYesterdayStr) {
      displayTitle = '前天'
    } else if (dateStr === yesterdayStr) {
      displayTitle = '昨天'
    } else if (dateStr === todayStr) {
      displayTitle = '今天'
    } else if (dateStr === tomorrowStr) {
      displayTitle = '明天'
    } else if (dateStr === dayAfterTomorrowStr) {
      displayTitle = '后天'
    } else {
      // 计算距离今天的天数
      const orderDate = new Date(dateStr)
      orderDate.setHours(0, 0, 0, 0)
      const diffTime = orderDate - today
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        // 过去的日期：N天前
        displayTitle = `${Math.abs(diffDays)}天前`
      } else {
        // 未来的日期：N天后
        displayTitle = `${diffDays}天后`
      }
    }

    // 第二步：如果有聚餐日主题且不是快捷选项，则在右侧追加显示
    if (theme && !isQuickOption) {
      displayTitle = `${displayTitle} · ${theme}`
    }

    return {
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
   * 获取时间状态（用于样式控制）
   * @param {string} dateStr - 日期字符串 YYYY-MM-DD
   * @returns {string} - 'today' | 'upcoming' | 'past' | ''
   */
  getTimeStatus(dateStr) {
    if (!dateStr) return ''

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = this.formatDate(today)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = this.formatDate(tomorrow)

    const dayAfterTomorrow = new Date(today)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
    const dayAfterTomorrowStr = this.formatDate(dayAfterTomorrow)

    // 判断是今天、即将到来还是已过去
    if (dateStr === todayStr) {
      return 'today'
    } else if (dateStr === tomorrowStr || dateStr === dayAfterTomorrowStr) {
      return 'upcoming'
    } else if (dateStr > todayStr) {
      return 'upcoming' // 未来的日期
    } else {
      return 'past' // 过去的日期
    }
  },

  /**
   * 删除投喂任务
   */
  async deleteOrder(e) {
    const { id } = e.currentTarget.dataset

    try {
      // 确认删除
      await wx.showModal({
        title: '确认删除',
        content: '确定要删除这个投喂任务吗？',
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
        // 重新加载任务列表
        this.loadOrders()
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      if (err.errMsg && err.errMsg.includes('cancel')) {
        // 用户取消删除
        return
      }
      console.error('删除投喂任务失败', err)
      wx.hideLoading()
      wx.showToast({
        title: err.message || '删除失败',
        icon: 'none'
      })
    }
  },

  /**
   * 编辑投喂任务
   */
  async editOrder(e) {
    const { order } = e.currentTarget.dataset

    try {
      // 先提示用户
      const confirmRes = await wx.showModal({
        title: '要改主意啦？',
        content: '改菜单的话，我得把原来的投喂任务撤了，你重新点完菜再提交哦～不然我可不知道你到底想吃啥！😋',
        confirmText: '要改',
        cancelText: '算了',
        confirmColor: '#FF9800'
      })

      if (!confirmRes.confirm) {
        // 用户取消
        return
      }

      wx.showLoading({ title: '正在准备...' })

      // 获取 app 实例
      const app = getApp()

      // 先删除原订单
      console.log('开始删除订单:', order._id)
      const deleteRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'deleteOrder',
          id: order._id
        }
      })

      console.log('删除订单结果:', deleteRes)

      if (!deleteRes.result.success) {
        throw new Error(deleteRes.result.message || '删除原订单失败')
      }

      // 清空当前购物车
      app.clearCart()

      // 从数据库加载完整的菜品信息（包括图片）
      console.log('开始加载菜品信息')
      const dishesRes = await wx.cloud.callFunction({
        name: 'menu',
        data: {
          action: 'getList'
        }
      })

      console.log('菜品信息加载结果:', dishesRes)

      if (!dishesRes.result.success) {
        throw new Error(dishesRes.result.message || '加载菜品信息失败')
      }

      // 创建菜品ID到完整菜品信息的映射
      const dishMap = {}
      dishesRes.result.data.forEach(dish => {
        dishMap[dish._id] = dish
      })

      console.log('开始加载菜品到购物车，订单菜品数量:', order.dishes.length)

      // 将订单的菜品加载到购物车，使用完整的菜品信息
      order.dishes.forEach(dish => {
        const fullDish = dishMap[dish.dishId]
        if (fullDish) {
          app.addToCart({
            _id: fullDish._id,
            name: fullDish.name,
            category: fullDish.category,
            image: fullDish.image, // 包含图片信息
            description: fullDish.description,
            count: dish.count
          })
        } else {
          // 如果找不到菜品（可能已被删除），使用订单中保存的基本信息
          console.log('菜品未找到，使用订单数据:', dish)
          app.addToCart({
            _id: dish.dishId,
            name: dish.name,
            category: dish.category,
            count: dish.count
          })
        }
      })

      // 设置聚餐日信息
      if (order.gatheringDayId) {
        app.setSelectedGathering({
          _id: order.gatheringDayId,
          theme: order.gatheringDayTheme,
          date: order.gatheringDayDate
        })
      }

      // 将备注保存到页面的缓存中，供购物车页面使用
      wx.setStorageSync('editingOrderNotes', order.notes || '')

      wx.hideLoading()

      wx.showToast({
        title: '原任务已撤销',
        icon: 'success',
        duration: 1500
      })

      console.log('准备跳转到购物车页面')

      // 短暂延迟后跳转到购物车页面
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/cart/cart'
        })
      }, 1500)
    } catch (err) {
      console.error('编辑投喂任务失败', err)
      wx.hideLoading()
      wx.showToast({
        title: err.message || '操作失败',
        icon: 'none',
        duration: 3000
      })
    }
  }
})
