// pages/cart/cart.js
const app = getApp()
const { CATEGORIES } = require('../../utils/constants.js')
const { hasPermission } = require('../../utils/roles.js')

Page({
  data: {
    cart: [],
    notes: '',
    totalCount: 0,
    selectedGathering: null, // 选中的聚餐日对象（从点菜页面传来）
    userInfo: null // 用户信息
  },

  onLoad() {
    this.loadUserInfo()
    this.loadCart()
    this.loadSelectedGathering()
    this.loadNotes()
  },

  onShow() {
    this.loadCart()
    this.loadSelectedGathering()
    this.loadNotes()
  },

  /**
   * 加载备注信息（从缓存或编辑模式）
   */
  loadNotes() {
    // 优先加载编辑模式的备注
    const editingOrderNotes = wx.getStorageSync('editingOrderNotes')
    if (editingOrderNotes) {
      this.setData({
        notes: editingOrderNotes
      })
      // 清除编辑模式缓存，并保存到普通备注缓存
      wx.removeStorageSync('editingOrderNotes')
      wx.setStorageSync('cartNotes', editingOrderNotes)
      return
    }

    // 加载普通缓存的备注
    const cachedNotes = wx.getStorageSync('cartNotes')
    if (cachedNotes) {
      this.setData({
        notes: cachedNotes
      })
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
        this.setData({
          userInfo: res.result.data
        })
      }
    } catch (err) {
      console.error('加载用户信息失败', err)
    }
  },

  /**
   * 加载选中的聚餐日（从点菜页面选择的）
   */
  loadSelectedGathering() {
    const selectedGathering = app.getSelectedGathering()

    // 设置选中的聚餐日（可能为 null/undefined）
    this.setData({
      selectedGathering: selectedGathering || null
    })
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
    const notes = e.detail.value
    this.setData({
      notes: notes
    })
    // 实时保存到本地存储
    wx.setStorageSync('cartNotes', notes)
  },

  /**
   * 显示聚餐日修改提示
   */
  showGatheringTip() {
    wx.showModal({
      title: '温馨提示',
      content: '当前聚餐日已锁定，无法在此修改。\n\n如需更换聚餐日，请返回选菜页面重新选择哦！',
      confirmText: '返回选菜',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          // 用户点击"返回选菜"，跳转到菜单页面
          this.goToMenu()
        }
      }
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
        title: '暂无可选聚餐日',
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

      // 创建新订单
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

        // 清空备注缓存
        wx.removeStorageSync('cartNotes')

        wx.showToast({
          title: '投喂任务已接收',
          icon: 'success'
        })

        // 跳转到任务历史页面
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/order-history/order-history'
          })
        }, 1500)
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      console.error('提交投喂任务失败', err)
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
    // 获取当前页面栈
    const pages = getCurrentPages()

    // 检查页面栈中是否有菜单页面
    let hasMenuPage = false
    let menuPageIndex = -1

    for (let i = pages.length - 1; i >= 0; i--) {
      if (pages[i].route === 'pages/menu/menu') {
        hasMenuPage = true
        menuPageIndex = i
        break
      }
    }

    if (hasMenuPage) {
      // 如果页面栈中有菜单页面，计算需要返回的层数
      const delta = pages.length - 1 - menuPageIndex
      wx.navigateBack({
        delta: delta
      })
    } else {
      // 如果页面栈中没有菜单页面，跳转到菜单页面
      wx.redirectTo({
        url: '/pages/menu/menu'
      })
    }
  }
})
