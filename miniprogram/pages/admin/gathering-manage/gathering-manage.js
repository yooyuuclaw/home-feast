// pages/admin/gathering-manage/gathering-manage.js
Page({
  data: {
    gatheringDays: [],
    loading: true
  },

  onLoad() {
    this.loadGatheringDays()
  },

  onShow() {
    // 从编辑页面返回时重新加载
    this.loadGatheringDays()
  },

  /**
   * 加载聚餐日列表
   */
  async loadGatheringDays() {
    try {
      this.setData({ loading: true })

      const res = await wx.cloud.callFunction({
        name: 'gathering-day',
        data: {
          action: 'list'
        }
      })

      if (res.result.success) {
        // 处理数据，标记餐次
        const gatheringDays = res.result.data.map(item => ({
          ...item,
          hasBreakfast: item.meals.includes('breakfast'),
          hasLunch: item.meals.includes('lunch'),
          hasDinner: item.meals.includes('dinner')
        }))

        this.setData({
          gatheringDays: gatheringDays,
          loading: false
        })
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      console.error('加载聚餐日失败', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 跳转到编辑页面
   */
  goToEdit(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      // 编辑
      wx.navigateTo({
        url: `/pages/admin/gathering-edit/gathering-edit?id=${id}`
      })
    } else {
      // 新增
      wx.navigateTo({
        url: '/pages/admin/gathering-edit/gathering-edit'
      })
    }
  },

  /**
   * 删除聚餐日
   */
  async deleteGatheringDay(e) {
    const { id } = e.currentTarget.dataset

    try {
      await wx.showModal({
        title: '确认删除',
        content: '确定要删除这个聚餐日吗？',
        confirmText: '删除',
        confirmColor: '#fa5151'
      })

      wx.showLoading({ title: '删除中...' })

      const res = await wx.cloud.callFunction({
        name: 'gathering-day',
        data: {
          action: 'delete',
          id: id
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        this.loadGatheringDays()
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      if (err.errMsg && err.errMsg.includes('cancel')) {
        return
      }
      console.error('删除聚餐日失败', err)
      wx.hideLoading()
      wx.showToast({
        title: err.message || '删除失败',
        icon: 'none'
      })
    }
  }
})
