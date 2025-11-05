// pages/admin/gathering-edit/gathering-edit.js
Page({
  data: {
    isEdit: false,
    gatheringId: '',
    formData: {
      theme: '',
      date: '',
      hasBreakfast: false,
      hasLunch: false,
      hasDinner: false
    }
  },

  onLoad(options) {
    if (options.id) {
      // 编辑模式
      this.setData({
        isEdit: true,
        gatheringId: options.id
      })
      this.loadGatheringDay(options.id)
    }
  },

  /**
   * 加载聚餐日数据
   */
  async loadGatheringDay(id) {
    try {
      wx.showLoading({ title: '加载中...' })

      const res = await wx.cloud.callFunction({
        name: 'gathering-day',
        data: {
          action: 'list'
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        const item = res.result.data.find(g => g._id === id)
        if (item) {
          this.setData({
            formData: {
              theme: item.theme,
              date: item.date,
              hasBreakfast: item.meals.includes('breakfast'),
              hasLunch: item.meals.includes('lunch'),
              hasDinner: item.meals.includes('dinner')
            }
          })
        }
      }
    } catch (err) {
      wx.hideLoading()
      console.error('加载聚餐日失败', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 主题输入
   */
  onThemeInput(e) {
    this.setData({
      'formData.theme': e.detail.value
    })
  },

  /**
   * 日期选择
   */
  onDateChange(e) {
    this.setData({
      'formData.date': e.detail.value
    })
  },

  /**
   * 餐次选择
   */
  onMealChange(e) {
    const meal = e.currentTarget.dataset.meal
    const key = `formData.has${meal.charAt(0).toUpperCase() + meal.slice(1)}`
    this.setData({
      [key]: !this.data.formData[`has${meal.charAt(0).toUpperCase() + meal.slice(1)}`]
    })
  },

  /**
   * 提交表单
   */
  async submitForm() {
    const { theme, date, hasBreakfast, hasLunch, hasDinner } = this.data.formData

    // 验证
    if (!theme) {
      wx.showToast({
        title: '请输入主题',
        icon: 'none'
      })
      return
    }

    if (!date) {
      wx.showToast({
        title: '请选择日期',
        icon: 'none'
      })
      return
    }

    if (!hasBreakfast && !hasLunch && !hasDinner) {
      wx.showToast({
        title: '请至少选择一个餐次',
        icon: 'none'
      })
      return
    }

    // 构建餐次数组
    const meals = []
    if (hasBreakfast) meals.push('breakfast')
    if (hasLunch) meals.push('lunch')
    if (hasDinner) meals.push('dinner')

    try {
      wx.showLoading({ title: this.data.isEdit ? '保存中...' : '创建中...' })

      const action = this.data.isEdit ? 'update' : 'create'
      const data = {
        action: action,
        theme: theme,
        date: date,
        meals: meals
      }

      if (this.data.isEdit) {
        data.id = this.data.gatheringId
      }

      const res = await wx.cloud.callFunction({
        name: 'gathering-day',
        data: data
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: this.data.isEdit ? '保存成功' : '创建成功',
          icon: 'success'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      wx.hideLoading()
      console.error('提交失败', err)

      // 显示详细错误信息
      let errorMsg = '操作失败'
      if (err.message) {
        errorMsg = err.message
      } else if (err.errMsg) {
        errorMsg = err.errMsg
      } else if (err.error && err.error.message) {
        errorMsg = err.error.message
      }

      wx.showModal({
        title: '操作失败',
        content: errorMsg,
        showCancel: false
      })
    }
  },

  /**
   * 取消
   */
  cancelForm() {
    wx.navigateBack()
  }
})
