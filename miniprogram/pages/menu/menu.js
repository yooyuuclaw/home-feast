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

    // 其他人的订单（作为参考）
    othersOrders: [], // 其他人的订单菜品
    othersOrdersMap: {} // dishId -> count 的映射
  },

  onLoad() {
    this.loadUserInfo()
    this.loadDishes()
  },

  onShow() {
    // 更新购物车数量
    this.updateCartCount()
    // 如果已选择聚餐日，重新加载其他人的订单
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
      const userOpenid = this.data.userInfo._openid

      // 构建最终的选项列表
      const allDays = []

      // 今天
      const todayGathering = dateMap.get(todayStr)
      if (todayGathering) {
        if (canAccessAllDays || !todayGathering.invitedGuests || todayGathering.invitedGuests.length === 0 || todayGathering.invitedGuests.includes(userOpenid)) {
          const mealLabels = []
          if (todayGathering.meals.includes('breakfast')) mealLabels.push('早餐')
          if (todayGathering.meals.includes('lunch')) mealLabels.push('午餐')
          if (todayGathering.meals.includes('dinner')) mealLabels.push('晚餐')

          allDays.push({
            ...todayGathering,
            displayText: `${todayGathering.theme} - 今天 (${todayStr}${mealLabels.length > 0 ? '，' + mealLabels.join('、') : ''})`,
            dateLabel: '今天'
          })
        }
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
        if (canAccessAllDays || !tomorrowGathering.invitedGuests || tomorrowGathering.invitedGuests.length === 0 || tomorrowGathering.invitedGuests.includes(userOpenid)) {
          const mealLabels = []
          if (tomorrowGathering.meals.includes('breakfast')) mealLabels.push('早餐')
          if (tomorrowGathering.meals.includes('lunch')) mealLabels.push('午餐')
          if (tomorrowGathering.meals.includes('dinner')) mealLabels.push('晚餐')

          allDays.push({
            ...tomorrowGathering,
            displayText: `${tomorrowGathering.theme} - 明天 (${tomorrowStr}${mealLabels.length > 0 ? '，' + mealLabels.join('、') : ''})`,
            dateLabel: '明天'
          })
        }
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
        if (canAccessAllDays || !dayAfterTomorrowGathering.invitedGuests || dayAfterTomorrowGathering.invitedGuests.length === 0 || dayAfterTomorrowGathering.invitedGuests.includes(userOpenid)) {
          const mealLabels = []
          if (dayAfterTomorrowGathering.meals.includes('breakfast')) mealLabels.push('早餐')
          if (dayAfterTomorrowGathering.meals.includes('lunch')) mealLabels.push('午餐')
          if (dayAfterTomorrowGathering.meals.includes('dinner')) mealLabels.push('晚餐')

          allDays.push({
            ...dayAfterTomorrowGathering,
            displayText: `${dayAfterTomorrowGathering.theme} - 后天 (${dayAfterTomorrowStr}${mealLabels.length > 0 ? '，' + mealLabels.join('、') : ''})`,
            dateLabel: '后天'
          })
        }
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
            if (canAccessAllDays || !day.invitedGuests || day.invitedGuests.length === 0 || day.invitedGuests.includes(userOpenid)) {
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

      // 如果有选中的聚餐日，加载其他人的订单
      if (selectedGathering) {
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
   * 加载其他人的订单（作为参考）
   */
  async loadOthersOrders() {
    if (!this.data.selectedGathering) {
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getUserOrders'
        }
      })

      if (res.result.success) {
        const currentOpenid = res.result.currentOpenid
        const selectedGatheringId = this.data.selectedGathering._id

        // 筛选出该聚餐日其他人的订单
        const othersOrders = res.result.data.filter(order => {
          // 排除自己的订单
          if (order._openid === currentOpenid) return false
          // 匹配聚餐日ID
          if (selectedGatheringId.startsWith('quick-')) {
            // 快捷选项，按日期匹配
            return order.gatheringDayDate === this.data.selectedGathering.date
          } else {
            // 后台聚餐日，按ID匹配
            return order.gatheringDayId === selectedGatheringId
          }
        })

        // 构建菜品计数映射
        const dishCountMap = {}
        othersOrders.forEach(order => {
          order.dishes.forEach(dish => {
            if (dishCountMap[dish.dishId]) {
              dishCountMap[dish.dishId] += dish.count
            } else {
              dishCountMap[dish.dishId] = dish.count
            }
          })
        })

        this.setData({
          othersOrders: othersOrders,
          othersOrdersMap: dishCountMap
        })
      }
    } catch (err) {
      console.error('加载其他人订单失败', err)
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
