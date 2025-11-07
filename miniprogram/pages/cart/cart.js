// pages/cart/cart.js
const app = getApp()
const { CATEGORIES } = require('../../utils/constants.js')
const { hasPermission } = require('../../utils/roles.js')

Page({
  data: {
    cart: [],
    notes: '',
    totalCount: 0,
    gatheringDays: [], // 可用的聚餐日列表
    selectedGatheringIndex: -1, // 选中的聚餐日索引
    selectedGathering: null, // 选中的聚餐日对象
    userInfo: null // 用户信息
  },

  onLoad() {
    this.loadUserInfo()
    this.loadCart()
  },

  onShow() {
    this.loadCart()
    this.loadGatheringDays()
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
        this.setData({
          userInfo: res.result.data
        })
        // 用户信息加载完成后，再加载聚餐日
        this.loadGatheringDays()
      }
    } catch (err) {
      console.error('加载用户信息失败', err)
    }
  },

  /**
   * 加载购物车数据
   */
  loadCart() {
    const cart = app.getCart()
    const totalCount = cart.reduce((sum, item) => sum + item.count, 0)

    this.setData({
      cart: cart,
      totalCount: totalCount
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
   * 增加数量
   */
  increaseCount(e) {
    const id = e.currentTarget.dataset.id
    const cart = this.data.cart
    const item = cart.find(item => item._id === id)

    if (item) {
      item.count++
      app.updateCartItem(id, item.count)
      this.loadCart()
    }
  },

  /**
   * 减少数量
   */
  decreaseCount(e) {
    const id = e.currentTarget.dataset.id
    const cart = this.data.cart
    const item = cart.find(item => item._id === id)

    if (item) {
      if (item.count > 1) {
        item.count--
        app.updateCartItem(id, item.count)
      } else {
        // 数量为1时，确认是否删除
        wx.showModal({
          title: '提示',
          content: '确定要移除该菜品吗？',
          success: (res) => {
            if (res.confirm) {
              app.updateCartItem(id, 0)
              this.loadCart()
            }
          }
        })
        return
      }
      this.loadCart()
    }
  },

  /**
   * 备注输入
   */
  onNotesInput(e) {
    this.setData({
      notes: e.detail.value
    })
  },

  /**
   * 加载聚餐日列表
   */
  async loadGatheringDays() {
    // 等待用户信息加载
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
        // 检查权限：如果是受邀访客，需要检查是否在邀请列表中
        if (canAccessAllDays || !todayGathering.invitedGuests || todayGathering.invitedGuests.length === 0 || todayGathering.invitedGuests.includes(userOpenid)) {
          // 有后台设定的聚餐日，合并显示
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
        // 只有常客及以上角色才能使用快捷选项（没有后台聚餐日的情况）
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

      // 添加其他后台聚餐日（不是今天、明天、后天的）
      if (res.result.success) {
        res.result.data.forEach(day => {
          if (day.date > dayAfterTomorrowStr) {
            // 检查权限
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
      this.setData({
        gatheringDays: allDays,
        selectedGatheringIndex: selectedIndex,
        selectedGathering: allDays[selectedIndex]
      })
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
   * 选择聚餐日
   */
  onGatheringChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      selectedGatheringIndex: index,
      selectedGathering: this.data.gatheringDays[index]
    })
  },

  /**
   * 提交订单
   */
  async submitOrder() {
    const { cart, notes, selectedGathering } = this.data

    if (cart.length === 0) {
      wx.showToast({
        title: '购物车是空的',
        icon: 'none'
      })
      return
    }

    // 检查是否选择了聚餐日
    if (!selectedGathering) {
      wx.showToast({
        title: '请选择聚餐日',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '提交中...' })

      // 构建订单数据
      const dishes = cart.map(item => ({
        dishId: item._id,
        name: item.name,
        category: item.category,
        count: item.count
      }))

      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'create',
          dishes: dishes,
          notes: notes,
          gatheringDayId: selectedGathering._id,
          gatheringDayTheme: selectedGathering.theme,
          gatheringDayDate: selectedGathering.date
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        // 清空购物车
        app.clearCart()

        wx.showToast({
          title: '订单提交成功',
          icon: 'success'
        })

        // 跳转到订单历史页面
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/order-history/order-history'
          })
        }, 1500)
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      console.error('提交订单失败', err)
      wx.hideLoading()
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      })
    }
  },

  /**
   * 返回菜单页面
   */
  goToMenu() {
    wx.navigateBack()
  }
})
