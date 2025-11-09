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
        // 云函数已经根据用户角色过滤了聚餐日，前端不需要再判断权限
        const mealLabels = []
        if (todayGathering.meals.includes('breakfast')) mealLabels.push('早餐')
        if (todayGathering.meals.includes('lunch')) mealLabels.push('午餐')
        if (todayGathering.meals.includes('dinner')) mealLabels.push('晚餐')

        allDays.push({
          ...todayGathering,
          displayText: `${todayGathering.theme} - 今天 (${todayStr}${mealLabels.length > 0 ? '，' + mealLabels.join('、') : ''})`,
          dateLabel: '今天'
        })
      } else if (canAccessAllDays) {
        allDays.push({
          _id: 'quick-today',
          theme: '今天',
          date: todayStr,
          meals: [],
          displayText: `今天 (${todayStr})`,
          isQuickOption: true,
          dateLabel: '今天'
        })
      }

      // 明天
      const tomorrowGathering = dateMap.get(tomorrowStr)
      if (tomorrowGathering) {
        const mealLabels = []
        if (tomorrowGathering.meals.includes('breakfast')) mealLabels.push('早餐')
        if (tomorrowGathering.meals.includes('lunch')) mealLabels.push('午餐')
        if (tomorrowGathering.meals.includes('dinner')) mealLabels.push('晚餐')

        allDays.push({
          ...tomorrowGathering,
          displayText: `${tomorrowGathering.theme} - 明天 (${tomorrowStr}${mealLabels.length > 0 ? '，' + mealLabels.join('、') : ''})`,
          dateLabel: '明天'
        })
      } else if (canAccessAllDays) {
        allDays.push({
          _id: 'quick-tomorrow',
          theme: '明天',
          date: tomorrowStr,
          meals: [],
          displayText: `明天 (${tomorrowStr})`,
          isQuickOption: true,
          dateLabel: '明天'
        })
      }

      // 后天
      const dayAfterTomorrowGathering = dateMap.get(dayAfterTomorrowStr)
      if (dayAfterTomorrowGathering) {
        const mealLabels = []
        if (dayAfterTomorrowGathering.meals.includes('breakfast')) mealLabels.push('早餐')
        if (dayAfterTomorrowGathering.meals.includes('lunch')) mealLabels.push('午餐')
        if (dayAfterTomorrowGathering.meals.includes('dinner')) mealLabels.push('晚餐')

        allDays.push({
          ...dayAfterTomorrowGathering,
          displayText: `${dayAfterTomorrowGathering.theme} - 后天 (${dayAfterTomorrowStr}${mealLabels.length > 0 ? '，' + mealLabels.join('、') : ''})`,
          dateLabel: '后天'
        })
      } else if (canAccessAllDays) {
        allDays.push({
          _id: 'quick-day-after-tomorrow',
          theme: '后天',
          date: dayAfterTomorrowStr,
          meals: [],
          displayText: `后天 (${dayAfterTomorrowStr})`,
          isQuickOption: true,
          dateLabel: '后天'
        })
      }

      // 添加其他后台聚餐日
      if (res.result.success) {
        res.result.data.forEach(day => {
          if (day.date > dayAfterTomorrowStr) {
            const mealLabels = []
            if (day.meals.includes('breakfast')) mealLabels.push('早餐')
            if (day.meals.includes('lunch')) mealLabels.push('午餐')
            if (day.meals.includes('dinner')) mealLabels.push('晚餐')

            allDays.push({
              ...day,
              displayText: `${day.theme} - ${day.date} (${mealLabels.join('、')})`,
              dateLabel: day.date
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
   * 筛选菜品
   */
  filterDishes() {
    const { dishes, currentCategory } = this.data

    if (currentCategory === '') {
      // 显示所有菜品
      this.setData({
        filteredDishes: dishes
      })
    } else {
      // 按分类筛选
      const filtered = dishes.filter(dish => dish.category === currentCategory)
      this.setData({
        filteredDishes: filtered
      })
    }
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
  }
})
