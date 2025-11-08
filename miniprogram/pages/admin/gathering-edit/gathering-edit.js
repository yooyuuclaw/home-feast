// pages/admin/gathering-edit/gathering-edit.js
const { getRoleName } = require('../../../utils/roles')

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
    },
    // 受邀访客相关
    allInvitedGuests: [], // 所有受邀访客用户
    selectedGuests: [], // 已选择的受邀访客openid数组
    showGuestPicker: false
  },

  onLoad(options) {
    // 加载所有受邀访客
    this.loadInvitedGuests()

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
   * 加载所有受邀访客
   */
  async loadInvitedGuests() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'list'
        }
      })

      if (res.result.success) {
        // 筛选出受邀访客
        const invitedGuests = res.result.data.filter(user => user.role === 'invited_guest')
        this.setData({
          allInvitedGuests: invitedGuests
        })
      }
    } catch (err) {
      console.error('加载受邀访客失败', err)
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
          // 确保 invitedGuests 是一个字符串数组
          const invitedGuests = (item.invitedGuests || []).map(String)

          console.log('加载的受邀访客:', invitedGuests)
          console.log('所有受邀访客:', this.data.allInvitedGuests.map(u => u._openid))

          this.setData({
            formData: {
              theme: item.theme,
              date: item.date,
              hasBreakfast: item.meals.includes('breakfast'),
              hasLunch: item.meals.includes('lunch'),
              hasDinner: item.meals.includes('dinner')
            },
            selectedGuests: invitedGuests
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
   * 打开受邀访客选择器
   */
  openGuestPicker() {
    // 打开时刷新受邀访客列表，确保数据最新
    this.loadInvitedGuests()
    this.setData({
      showGuestPicker: true
    })
  },

  /**
   * 关闭受邀访客选择器
   */
  closeGuestPicker() {
    this.setData({
      showGuestPicker: false
    })
  },

  /**
   * checkbox-group change事件
   */
  onGuestCheckboxChange(e) {
    const selectedGuests = e.detail.value
    console.log('checkbox change:', selectedGuests)

    // 去重,防止重复添加
    const uniqueGuests = [...new Set(selectedGuests)]
    console.log('去重后:', uniqueGuests)

    this.setData({
      selectedGuests: uniqueGuests
    })
  },

  /**
   * 确认选择受邀访客
   */
  confirmGuestSelection() {
    this.setData({
      showGuestPicker: false
    })
  },

  /**
   * 移除已选择的访客
   */
  removeGuest(e) {
    const openid = e.currentTarget.dataset.openid
    const selectedGuests = this.data.selectedGuests.filter(g => g !== openid)
    this.setData({
      selectedGuests: selectedGuests
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
        meals: meals,
        invitedGuests: this.data.selectedGuests // 添加受邀访客
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
