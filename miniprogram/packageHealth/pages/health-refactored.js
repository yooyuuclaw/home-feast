// pages/health/health.js
/**
 * 健康小本本 - 主入口文件
 * 模块化重构版本
 */

import healthRecordMixin from './mixins/health-record.js'
import waterTrackerMixin from './mixins/water-tracker.js'
import medicineReminderMixin from './mixins/medicine-reminder.js'
import authorizationMixin from './mixins/authorization.js'
import { getTodayDateString } from './utils/date-formatter.js'
import { getViewModeMessage } from './utils/type-helper.js'

const app = getApp()

Page({
  data: {
    userInfo: null,
    todayDate: '',
    loading: true,

    // 当前标签页
    currentTab: 'health',

    // 查看模式相关(声明在主文件中,供mixins使用)
    currentViewingOpenid: null,
    currentViewingNickname: ''
  },

  onLoad() {
    this.checkPermission()
    this.setData({ todayDate: getTodayDateString() })
    this.loadWaterGoal()
    this.loadAuthorizationLists()
  },

  onShow() {
    const loadFunctions = {
      'health': this.loadHealthData,
      'water': this.loadWaterData,
      'medicine': this.loadMedicineData
    }
    const loadFunc = loadFunctions[this.data.currentTab]
    if (loadFunc) {
      loadFunc.call(this)
    }
  },

  /**
   * 切换标签页
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })

    const loadFunctions = {
      'health': this.loadHealthData,
      'water': this.loadWaterData,
      'medicine': this.loadMedicineData
    }
    const loadFunc = loadFunctions[tab]
    if (loadFunc) {
      loadFunc.call(this)
    }
  },

  /**
   * 检查权限
   */
  checkPermission() {
    const userInfo = app.globalData.userInfo
    // 只有未受邀访客无权访问，其他角色都可以访问
    if (!userInfo || userInfo.role === 'uninvited_guest') {
      wx.showModal({
        title: '权限不足',
        content: '未受邀访客无法访问健康管理功能',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    } else {
      this.setData({ userInfo })
    }
  },

  /**
   * 检查是否处于查看模式
   * @returns {boolean} 如果是查看模式返回true
   */
  checkViewMode() {
    if (this.data.currentViewingOpenid) {
      wx.showModal({
        title: '正在查看他人数据',
        content: getViewModeMessage(),
        showCancel: false,
        confirmText: '知道了'
      })
      return true
    }
    return false
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadHealthData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // ==================== 混入各功能模块 ====================
  // 健康打卡功能模块
  ...healthRecordMixin,

  // 喝水打卡功能模块
  ...waterTrackerMixin,

  // 吃药提醒功能模块
  ...medicineReminderMixin,

  // 授权管理功能模块
  ...authorizationMixin
})
