// pages/admin/order-manage/order-manage.js
const { ORDER_STATUS_TEXT } = require('../../../utils/constants.js')
const { formatTime } = require('../../../utils/util.js')

Page({
  data: {
    currentStatus: '',
    orders: [],
    loading: true
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

      const data = {
        action: 'getAllOrders'
      }

      if (this.data.currentStatus) {
        data.status = this.data.currentStatus
      }

      const res = await wx.cloud.callFunction({
        name: 'order',
        data: data
      })

      if (res.result.success) {
        // 获取所有菜品信息（包含食材）
        const menuRes = await wx.cloud.callFunction({
          name: 'menu',
          data: {
            action: 'getList',
            status: null  // 获取所有状态的菜品
          }
        })

        const menuMap = {}
        if (menuRes.result.success) {
          menuRes.result.data.forEach(dish => {
            menuMap[dish._id] = dish
          })
        }

        // 格式化订单数据并计算食材
        const orders = res.result.data.map(order => {
          const ingredientsMap = {}

          // 统计每个订单的食材
          order.dishes.forEach(dishOrder => {
            const dish = menuMap[dishOrder.dishId]
            if (dish && dish.ingredients && dish.ingredients.length > 0) {
              dish.ingredients.forEach(ingredient => {
                if (ingredient.trim()) {
                  if (ingredientsMap[ingredient]) {
                    ingredientsMap[ingredient] += dishOrder.count
                  } else {
                    ingredientsMap[ingredient] = dishOrder.count
                  }
                }
              })
            }
          })

          // 转换为数组格式
          const ingredientsList = Object.keys(ingredientsMap).map(name => ({
            name,
            count: ingredientsMap[name]
          }))

          return {
            ...order,
            createTimeFormatted: this.formatTime(order.createTime),
            statusText: this.getStatusText(order.status),
            ingredientsList: ingredientsList  // 添加食材列表
          }
        })

        this.setData({
          orders: orders,
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
   * 选择状态筛选
   */
  selectStatus(e) {
    const status = e.currentTarget.dataset.status
    this.setData({
      currentStatus: status
    })
    this.loadOrders()
  },

  /**
   * 更新订单状态
   */
  async updateStatus(e) {
    const { id, status } = e.currentTarget.dataset

    try {
      wx.showLoading({ title: '更新中...' })

      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'updateStatus',
          id: id,
          status: status
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
        this.loadOrders()
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      console.error('更新订单状态失败', err)
      wx.hideLoading()
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
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
        content: '确定要删除这个订单吗？此操作不可恢复',
        confirmText: '删除',
        confirmColor: '#fa5151'
      })

      wx.showLoading({ title: '删除中...' })

      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'adminDeleteOrder',
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
