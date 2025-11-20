// pages/menu/menu.js
const app = getApp()
const { CATEGORIES } = require('../../utils/constants.js')
const { hasPermission } = require('../../utils/roles.js')

Page({
  data: {
    categories: CATEGORIES,
    currentCategory: '', // 当前选中的分类
    dishes: [], // 所有菜品
    filteredDishes: [], // 筛选后的菜品
    loading: true,
    cartCount: 0,
    searchKeyword: '', // 搜索关键字

    // 用户信息和权限
    userInfo: null,
    userRole: '',
    canOrder: false,

    // 聚餐日选择
    gatheringDays: [],
    selectedGatheringIndex: -1,
    selectedGathering: null,
    showGatheringPicker: false,

    // 菜品订单详情映射
    // dishId -> [{openid, nickname, avatar, count, isMe}, ...]
    dishOrdersMap: {}
  },

  onLoad() {
    this.loadUserInfo()
    this.loadDishes()
  },

  onShow() {
    // 更新购物车数量
    this.updateCartCount()
    // 如果已选择聚餐日，重新加载订单
    if (this.data.selectedGathering) {
      this.loadOthersOrders()
    }
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getUserInfo'
        }
      })

      if (res.result.success) {
        const userInfo = res.result.data
        const userRole = userInfo.role
        const canOrder = hasPermission(userRole, 'canOrder')

        this.setData({
          userInfo: userInfo,
          userRole: userRole,
          canOrder: canOrder
        })

        // 加载聚餐日列表
        this.loadGatheringDays()
      }
    } catch (err) {
      console.error('加载用户信息失败', err)
    }
  },

  /**
   * 加载聚餐日列表（复用购物车的逻辑）
   */
  async loadGatheringDays() {
    if (!this.data.userInfo) {
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'gathering-day',
        data: {
          action: 'list'
        }
      })

      // 获取今天、明天、后天的日期
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = this.formatDate(today)

      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = this.formatDate(tomorrow)

      const dayAfterTomorrow = new Date(today)
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
      const dayAfterTomorrowStr = this.formatDate(dayAfterTomorrow)

      // 创建一个日期到聚餐日的映射
      const dateMap = new Map()

      // 先处理后台的聚餐日
      if (res.result.success) {
        res.result.data.forEach(day => {
          if (day.date >= todayStr) {
            dateMap.set(day.date, day)
          }
        })
      }

      // 获取用户角色和权限
      const userRole = this.data.userInfo.role
      const canAccessAllDays = hasPermission(userRole, 'canAccessAllGatheringDays')

      // 构建最终的选项列表
      const allDays = []

      // 今天
      const todayGathering = dateMap.get(todayStr)
      if (todayGathering) {
        // 如果今天有自定义聚餐日，使用聚餐日主题作为标题
        const dateLabels = this.getDateLabels(todayStr, todayStr)
        const weekday = this.getWeekday(todayStr)
        const displayText = this.formatGatheringDisplay(todayGathering, dateLabels.relativeLabel, weekday, todayStr)

        allDays.push({
          ...todayGathering,
          displayText: displayText,
          displayTitle: todayGathering.theme, // 主标题：聚餐日主题
          displaySubtitle: dateLabels.fullDate, // 副标题：完整日期
          dateLabel: dateLabels.relativeLabel // 相对日期标签
        })
      } else if (canAccessAllDays) {
        // 快速选项：今天
        const dateLabels = this.getDateLabels(todayStr, todayStr)
        const weekday = this.getWeekday(todayStr)
        const quickGathering = {
          _id: 'quick-today',
          theme: '今天',
          date: todayStr,
          meals: [],
          isQuickOption: true
        }
        const displayText = this.formatGatheringDisplay(quickGathering, dateLabels.relativeLabel, weekday, todayStr)

        allDays.push({
          ...quickGathering,
          displayText: displayText,
          displayTitle: '今天', // 主标题：今天
          displaySubtitle: dateLabels.fullDate, // 副标题：完整日期
          dateLabel: dateLabels.relativeLabel
        })
      }

      // 明天
      const tomorrowGathering = dateMap.get(tomorrowStr)
      if (tomorrowGathering) {
        const dateLabels = this.getDateLabels(tomorrowStr, todayStr)
        const weekday = this.getWeekday(tomorrowStr)
        const displayText = this.formatGatheringDisplay(tomorrowGathering, dateLabels.relativeLabel, weekday, tomorrowStr)

        allDays.push({
          ...tomorrowGathering,
          displayText: displayText,
          displayTitle: tomorrowGathering.theme,
          displaySubtitle: dateLabels.fullDate,
          dateLabel: dateLabels.relativeLabel
        })
      } else if (canAccessAllDays) {
        const dateLabels = this.getDateLabels(tomorrowStr, todayStr)
        const weekday = this.getWeekday(tomorrowStr)
        const quickGathering = {
          _id: 'quick-tomorrow',
          theme: '明天',
          date: tomorrowStr,
          meals: [],
          isQuickOption: true
        }
        const displayText = this.formatGatheringDisplay(quickGathering, dateLabels.relativeLabel, weekday, tomorrowStr)

        allDays.push({
          ...quickGathering,
          displayText: displayText,
          displayTitle: '明天',
          displaySubtitle: dateLabels.fullDate,
          dateLabel: dateLabels.relativeLabel
        })
      }

      // 后天
      const dayAfterTomorrowGathering = dateMap.get(dayAfterTomorrowStr)
      if (dayAfterTomorrowGathering) {
        const dateLabels = this.getDateLabels(dayAfterTomorrowStr, todayStr)
        const weekday = this.getWeekday(dayAfterTomorrowStr)
        const displayText = this.formatGatheringDisplay(dayAfterTomorrowGathering, dateLabels.relativeLabel, weekday, dayAfterTomorrowStr)

        allDays.push({
          ...dayAfterTomorrowGathering,
          displayText: displayText,
          displayTitle: dayAfterTomorrowGathering.theme,
          displaySubtitle: dateLabels.fullDate,
          dateLabel: dateLabels.relativeLabel
        })
      } else if (canAccessAllDays) {
        const dateLabels = this.getDateLabels(dayAfterTomorrowStr, todayStr)
        const weekday = this.getWeekday(dayAfterTomorrowStr)
        const quickGathering = {
          _id: 'quick-day-after-tomorrow',
          theme: '后天',
          date: dayAfterTomorrowStr,
          meals: [],
          isQuickOption: true
        }
        const displayText = this.formatGatheringDisplay(quickGathering, dateLabels.relativeLabel, weekday, dayAfterTomorrowStr)

        allDays.push({
          ...quickGathering,
          displayText: displayText,
          displayTitle: '后天',
          displaySubtitle: dateLabels.fullDate,
          dateLabel: dateLabels.relativeLabel
        })
      }

      // 添加其他后台聚餐日
      if (res.result.success) {
        res.result.data.forEach(day => {
          if (day.date > dayAfterTomorrowStr) {
            const dateLabels = this.getDateLabels(day.date, todayStr)
            const weekday = this.getWeekday(day.date)
            const displayText = this.formatGatheringDisplay(day, dateLabels.relativeLabel, weekday, day.date)

            allDays.push({
              ...day,
              displayText: displayText,
              displayTitle: day.theme,
              displaySubtitle: dateLabels.fullDate,
              dateLabel: dateLabels.relativeLabel
            })
          }
        })
      }

      // 默认选择第一个选项（如果有的话）
      const selectedIndex = allDays.length > 0 ? 0 : -1
      const selectedGathering = allDays[selectedIndex]

      this.setData({
        gatheringDays: allDays,
        selectedGatheringIndex: selectedIndex,
        selectedGathering: selectedGathering
      })

      // 如果有选中的聚餐日，保存到全局并加载其他人的订单
      if (selectedGathering) {
        app.setSelectedGathering(selectedGathering)
        this.loadOthersOrders()
      } else {
        // 如果没有可选聚餐日，清除旧的缓存
        app.clearSelectedGathering()
      }
    } catch (err) {
      console.error('加载聚餐日失败', err)
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
   * 计算相对日期显示文字和完整日期
   * 返回 { relativeLabel: '今天'/'明天'/'3天后', fullDate: '2025-11-10 周日' }
   */
  getDateLabels(dateStr, todayStr) {
    const targetDate = new Date(dateStr)
    const today = new Date(todayStr)

    // 计算天数差异
    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    let relativeLabel = ''
    if (diffDays === -1) {
      relativeLabel = '昨天'
    } else if (diffDays === 0) {
      relativeLabel = '今天'
    } else if (diffDays === 1) {
      relativeLabel = '明天'
    } else if (diffDays === 2) {
      relativeLabel = '后天'
    } else if (diffDays < 0) {
      relativeLabel = `${Math.abs(diffDays)}天前`
    } else {
      relativeLabel = `${diffDays}天后`
    }

    const weekday = this.getWeekday(dateStr)
    const fullDate = `${dateStr} ${weekday}`

    return { relativeLabel, fullDate }
  },

  /**
   * 格式化聚餐日显示文本
   * 格式：[聚餐日主题] + 今天/明天/后天/N天后 + 周几 + 日期 + [早餐/午餐/晚餐]
   * @param {Object} gathering - 聚餐日对象
   * @param {string} relativeLabel - 相对日期标签（今天、明天等）
   * @param {string} weekday - 星期几
   * @param {string} dateStr - 日期字符串
   * @returns {string} 格式化后的显示文本
   */
  formatGatheringDisplay(gathering, relativeLabel, weekday, dateStr) {
    const parts = []

    // 判断是否为快捷选项
    const isQuickOption = gathering.theme === '今天' || gathering.theme === '明天' ||
                          gathering.theme === '后天' || gathering.isQuickOption

    // 第一部分：聚餐日主题（如果不是快捷选项）
    if (!isQuickOption && gathering.theme) {
      parts.push(gathering.theme)
    }

    // 第二部分：相对日期（今天、明天、后天、N天后）
    parts.push(relativeLabel)

    // 第三部分：星期几
    parts.push(weekday)

    // 第四部分：具体日期
    parts.push(dateStr)

    // 第五部分：早餐/午餐/晚餐（如果有）
    if (gathering.meals && gathering.meals.length > 0) {
      const mealLabels = []
      if (gathering.meals.includes('breakfast')) mealLabels.push('早餐')
      if (gathering.meals.includes('lunch')) mealLabels.push('午餐')
      if (gathering.meals.includes('dinner')) mealLabels.push('晚餐')
      if (mealLabels.length > 0) {
        parts.push(mealLabels.join('/'))
      }
    }

    return parts.join(' ')
  },

  /**
   * 打开聚餐日选择器
   */
  openGatheringPicker() {
    // 检查权限
    if (!this.data.canOrder) {
      wx.showModal({
        title: '权限不足',
        content: '您当前是未受邀访客，暂无点菜权限。请联系管理员升级您的账号。',
        showCancel: false
      })
      return
    }

    if (this.data.gatheringDays.length === 0) {
      wx.showToast({
        title: '暂无可选聚餐日',
        icon: 'none'
      })
      return
    }

    this.setData({
      showGatheringPicker: true
    })
  },

  /**
   * 选择聚餐日
   */
  onGatheringChange(e) {
    const index = parseInt(e.detail.value)
    const selectedGathering = this.data.gatheringDays[index]

    this.setData({
      selectedGatheringIndex: index,
      selectedGathering: selectedGathering,
      showGatheringPicker: false
    })

    // 保存到全局
    app.setSelectedGathering(selectedGathering)

    // 加载该聚餐日其他人的订单
    this.loadOthersOrders()
  },

  /**
   * 关闭聚餐日选择器
   */
  closeGatheringPicker() {
    this.setData({
      showGatheringPicker: false
    })
  },

  /**
   * 加载订单数据(包括已提交订单和购物车)
   */
  async loadOthersOrders() {
    if (!this.data.selectedGathering) {
      return
    }

    try {
      // 1. 加载已提交的订单
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getUserOrders'
        }
      })

      if (res.result.success) {
        const currentUserId = res.result.currentUserId  // 改用 userId
        const selectedGatheringId = this.data.selectedGathering._id

        // 筛选出该聚餐日的所有已提交订单
        const submittedOrders = res.result.data.filter(order => {
          // 匹配聚餐日ID
          if (selectedGatheringId.startsWith('quick-')) {
            return order.gatheringDayDate === this.data.selectedGathering.date
          } else {
            return order.gatheringDayId === selectedGatheringId
          }
        })

        // 2. 获取当前用户信息
        const userInfo = this.data.userInfo

        // 3. 获取购物车数据(未提交的订单)
        const cart = app.getCart()

        // 4. 构建菜品 -> 订单人列表的映射
        // dishId -> [{userId, nickname, avatar, count, isMe, isPending}, ...]
        const dishOrdersMap = {}

        // 处理已提交的订单
        submittedOrders.forEach(order => {
          order.dishes.forEach(dish => {
            if (!dishOrdersMap[dish.dishId]) {
              dishOrdersMap[dish.dishId] = []
            }

            const existingOrder = dishOrdersMap[dish.dishId].find(
              item => item.userId === order.userId && !item.isPending
            )

            if (existingOrder) {
              existingOrder.count += dish.count
            } else {
              dishOrdersMap[dish.dishId].push({
                userId: order.userId,  // 改用 userId
                nickname: order.userName || '微信用户',  // userName 而不是 userNickname
                avatar: order.userAvatar || '',
                count: dish.count,
                isMe: order.userId === currentUserId,  // 改用 userId 比较
                isPending: false // 已提交的订单
              })
            }
          })
        })

        // 处理购物车中的订单(当前用户的待提交订单)
        cart.forEach(item => {
          if (!dishOrdersMap[item._id]) {
            dishOrdersMap[item._id] = []
          }

          // 查找是否已有当前用户的待提交订单
          const existingPending = dishOrdersMap[item._id].find(
            order => order.userId === currentUserId && order.isPending
          )

          if (existingPending) {
            existingPending.count = item.count
          } else {
            dishOrdersMap[item._id].push({
              userId: currentUserId,  // 改用 userId
              nickname: userInfo.nickname || '微信用户',
              avatar: userInfo.avatar || '',
              count: item.count,
              isMe: true,
              isPending: true // 购物车中的订单(待提交)
            })
          }
        })

        // 5. 对每个菜品的订单列表排序
        // 规则: 我的待提交订单 > 我的已提交订单 > 其他人的订单
        Object.keys(dishOrdersMap).forEach(dishId => {
          const orders = dishOrdersMap[dishId]
          orders.sort((a, b) => {
            // 我的待提交订单排最前
            if (a.isMe && a.isPending && !(b.isMe && b.isPending)) return -1
            if (!(a.isMe && a.isPending) && b.isMe && b.isPending) return 1
            // 我的已提交订单排第二
            if (a.isMe && !a.isPending && !(b.isMe && !b.isPending)) return -1
            if (!(a.isMe && !a.isPending) && b.isMe && !b.isPending) return 1
            // 其他保持原顺序
            return 0
          })
          // 限制最多5个
          dishOrdersMap[dishId] = orders.slice(0, 5)
        })

        this.setData({
          dishOrdersMap: dishOrdersMap
        })
      }
    } catch (err) {
      console.error('加载订单失败', err)
    }
  },

  /**
   * 加载菜品列表
   */
  async loadDishes() {
    try {
      this.setData({ loading: true })

      const res = await wx.cloud.callFunction({
        name: 'menu',
        data: {
          action: 'getList',
          status: 'online' // 只显示上架的菜品
        }
      })

      if (res.result.success) {
        this.setData({
          dishes: res.result.data,
          filteredDishes: res.result.data,
          loading: false
        })
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      console.error('加载菜品失败', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 搜索菜品
   */
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword
    })
    this.filterDishes()
  },

  /**
   * 清空搜索
   */
  clearSearch() {
    this.setData({
      searchKeyword: ''
    })
    this.filterDishes()
  },

  /**
   * 选择分类
   */
  selectCategory(e) {
    const category = e.currentTarget.dataset.category

    this.setData({
      currentCategory: category
    })

    this.filterDishes()
  },

  /**
   * 筛选菜品（支持分类和搜索关键字）
   */
  filterDishes() {
    const { dishes, currentCategory, searchKeyword } = this.data

    let filtered = dishes

    // 先按分类筛选
    if (currentCategory !== '') {
      filtered = filtered.filter(dish => dish.category === currentCategory)
    }

    // 再按搜索关键字筛选
    if (searchKeyword.trim() !== '') {
      const keyword = searchKeyword.trim().toLowerCase()
      filtered = filtered.filter(dish => {
        // 搜索菜品名称
        const nameMatch = dish.name.toLowerCase().includes(keyword)
        // 搜索分类名称
        const categoryName = this.getCategoryName(dish.category).toLowerCase()
        const categoryMatch = categoryName.includes(keyword)

        return nameMatch || categoryMatch
      })
    }

    this.setData({
      filteredDishes: filtered
    })
  },

  /**
   * 获取分类名称
   */
  getCategoryName(categoryId) {
    const category = CATEGORIES.find(cat => cat.id === categoryId)
    return category ? category.name : ''
  },

  /**
   * 显示菜品详情（可选功能）
   */
  showDishDetail(e) {
    // 暂不实现详情页，直接添加到购物车
  },

  /**
   * 添加到购物车
   */
  addToCart(e) {
    const dish = e.currentTarget.dataset.dish

    app.addToCart({
      ...dish,
      count: 1
    })

    this.updateCartCount()
    // 重新加载订单以更新显示
    this.loadOthersOrders()

    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
      duration: 1500
    })
  },

  /**
   * 更新购物车数量
   */
  updateCartCount() {
    const cart = app.getCart()
    const count = cart.reduce((sum, item) => sum + item.count, 0)
    this.setData({ cartCount: count })
  },

  /**
   * 跳转到购物车页面
   */
  goToCart() {
    wx.navigateTo({
      url: '/pages/cart/cart'
    })
  },

  /**
   * 转发给朋友
   */
  onShareAppMessage() {
    return {
      title: '璐璐和曼丽家的聚餐菜单',
      path: '/pages/menu/menu',
      imageUrl: '/images/share-cover.jpg'
    }
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '璐璐和曼丽家的聚餐菜单',
      query: '',
      imageUrl: '/images/share-cover.jpg'
    }
  }
})
