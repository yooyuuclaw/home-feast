/**
 * 喝水打卡功能模块
 */

import { filterTodayRecords } from '../utils/date-formatter.js'
import { calculateWeeklyStats, calculateStreakDays } from '../utils/data-calculator.js'

export default {
  data: {
    // 喝水打卡数据
    waterData: {
      goalAmount: 2000, // 默认2000ml
      todayAmount: 0,
      todayRecords: [],
      weeklyStats: {
        totalAmount: 0,
        avgAmount: 0,
        completeDays: 0
      },
      streakDays: 0  // 连续打卡天数
    },
    waterProgressPercent: 0,
    showWaterGoalModal: false,
    showCustomWaterModal: false,
    waterGoalInput: '',
    customWaterAmount: ''
  },

  /**
   * 加载饮水目标
   */
  loadWaterGoal() {
    const goal = wx.getStorageSync('waterGoal') || 2000
    this.setData({
      'waterData.goalAmount': goal
    })
  },

  /**
   * 加载喝水数据
   */
  async loadWaterData() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'getWaterRecords',
          targetOpenid: this.data.currentViewingOpenid
        }
      })

      if (res.result && res.result.success) {
        const records = res.result.data || []
        const todayRecords = filterTodayRecords(records)
        const todayAmount = todayRecords.reduce((sum, item) => sum + item.amount, 0)
        const percent = Math.min(Math.round((todayAmount / this.data.waterData.goalAmount) * 100), 100)

        // 使用工具函数计算本周统计数据
        const weeklyStats = calculateWeeklyStats(records, this.data.waterData.goalAmount)

        // 使用工具函数计算连续打卡天数
        const streakDays = calculateStreakDays(records, this.data.waterData.goalAmount)

        this.setData({
          'waterData.todayRecords': todayRecords,
          'waterData.todayAmount': todayAmount,
          'waterData.weeklyStats': weeklyStats,
          'waterData.streakDays': streakDays,
          waterProgressPercent: percent
        })
      } else {
        console.error('加载喝水数据失败:', res.result ? res.result.message : '未知错误')
      }
    } catch (err) {
      console.error('加载喝水数据失败', err)
    }
  },

  /**
   * 添加喝水记录
   */
  async addWater(e) {
    if (this.checkViewMode()) return

    const amount = parseInt(e.currentTarget.dataset.amount)

    try {
      wx.showLoading({ title: '记录中...' })

      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'addWaterRecord',
          amount: amount
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({ title: '记录成功', icon: 'success' })
        this.loadWaterData()
      } else {
        wx.showToast({ title: res.result.message || '记录失败', icon: 'none' })
      }
    } catch (err) {
      console.error('添加喝水记录失败', err)
      wx.hideLoading()
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },

  /**
   * 显示设置目标弹窗
   */
  showWaterGoalSetting() {
    if (this.checkViewMode()) return

    this.setData({
      showWaterGoalModal: true,
      waterGoalInput: this.data.waterData.goalAmount.toString()
    })
  },

  /**
   * 隐藏设置目标弹窗
   */
  hideWaterGoalSetting() {
    this.setData({ showWaterGoalModal: false })
  },

  /**
   * 目标输入
   */
  onWaterGoalInput(e) {
    this.setData({ waterGoalInput: e.detail.value })
  },

  /**
   * 快捷选择目标
   */
  selectQuickGoal(e) {
    const amount = e.currentTarget.dataset.amount
    this.setData({ waterGoalInput: amount.toString() })
  },

  /**
   * 保存饮水目标
   */
  saveWaterGoal() {
    const goal = parseInt(this.data.waterGoalInput)
    if (!goal || goal <= 0) {
      wx.showToast({ title: '请输入有效的目标值', icon: 'none' })
      return
    }

    wx.setStorageSync('waterGoal', goal)
    const percent = Math.min(Math.round((this.data.waterData.todayAmount / goal) * 100), 100)

    this.setData({
      'waterData.goalAmount': goal,
      waterProgressPercent: percent,
      showWaterGoalModal: false
    })

    wx.showToast({ title: '设置成功', icon: 'success' })
  },

  /**
   * 显示自定义加水弹窗
   */
  showCustomWaterInput() {
    if (this.checkViewMode()) return

    this.setData({
      showCustomWaterModal: true,
      customWaterAmount: ''
    })
  },

  /**
   * 隐藏自定义加水弹窗
   */
  hideCustomWaterInput() {
    this.setData({ showCustomWaterModal: false })
  },

  /**
   * 自定义水量输入
   */
  onCustomWaterInput(e) {
    this.setData({ customWaterAmount: e.detail.value })
  },

  /**
   * 确认自定义水量
   */
  async confirmCustomWater() {
    const amount = parseInt(this.data.customWaterAmount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效的水量', icon: 'none' })
      return
    }

    this.setData({ showCustomWaterModal: false })

    try {
      wx.showLoading({ title: '记录中...' })

      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'addWaterRecord',
          amount: amount
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({ title: '记录成功', icon: 'success' })
        this.loadWaterData()
      } else {
        wx.showToast({ title: res.result.message || '记录失败', icon: 'none' })
      }
    } catch (err) {
      console.error('添加喝水记录失败', err)
      wx.hideLoading()
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },

  /**
   * 删除喝水记录
   */
  deleteWaterRecord(e) {
    if (this.checkViewMode()) return

    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条喝水记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })

            const result = await wx.cloud.callFunction({
              name: 'health',
              data: {
                action: 'deleteWaterRecord',
                id: id
              }
            })

            wx.hideLoading()

            if (result.result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              this.loadWaterData()
            } else {
              wx.showToast({ title: result.result.message || '删除失败', icon: 'none' })
            }
          } catch (err) {
            console.error('删除喝水记录失败', err)
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
}
