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
import { processHealthChartData, getChartTypeOptions } from './utils/chart-helper.js'

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
    currentViewingNickname: '',

    // 图表相关数据
    chartTypeOptions: [],  // 先初始化为空数组，在 onLoad 中设置
    currentChartTypeIndex: 0,
    currentChartData: [],
    chartTimeRange: '7' // 默认显示7天
  },

  onLoad() {
    // 初始化图表选项和索引
    this.setData({
      chartTypeOptions: getChartTypeOptions(),
      currentChartTypeIndex: 0,  // 明确设置为 0
      chartTimeRange: '7'  // 明确设置为字符串 '7'
    })

    this.checkPermission()
    this.setData({ todayDate: getTodayDateString() })
    this.loadWaterGoal()
    this.loadAuthorizationLists()

    // 初始加载健康数据（修复血氧等数据不显示的问题）
    this.loadHealthData()

    // 调试：打印图表选项
    console.log('onLoad - chartTypeOptions:', this.data.chartTypeOptions)
    console.log('onLoad - currentChartTypeIndex:', this.data.currentChartTypeIndex)
    console.log('onLoad - chartTimeRange:', this.data.chartTimeRange)
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

  /**
   * 切换图表类型
   */
  onChartTypeChange(e) {
    const index = parseInt(e.detail.value)
    console.log('[onChartTypeChange] 切换图表类型, 从', this.data.currentChartTypeIndex, '到', index)
    console.log('[onChartTypeChange] 新类型:', this.data.chartTypeOptions[index])

    this.setData({ currentChartTypeIndex: index })
    this.updateChartData()
  },

  /**
   * 切换图表时间范围
   */
  onChartRangeChange(e) {
    const range = e.detail.range
    this.setData({ chartTimeRange: range })
    this.updateChartData()
  },

  /**
   * 更新图表数据
   */
  updateChartData() {
    const { chartTypeOptions, currentChartTypeIndex, chartTimeRange, allHealthRecords } = this.data

    console.log('=== 更新图表数据 ===')
    console.log('allHealthRecords:', allHealthRecords)
    console.log('allHealthRecords length:', allHealthRecords ? allHealthRecords.length : 0)
    console.log('currentChartTypeIndex:', currentChartTypeIndex)
    console.log('chartTypeOptions:', chartTypeOptions)
    console.log('chartTimeRange 原始值:', chartTimeRange, '类型:', typeof chartTimeRange)

    // 检查 chartTypeOptions 是否已初始化
    if (!chartTypeOptions || chartTypeOptions.length === 0) {
      console.log('图表选项未初始化')
      this.setData({ currentChartData: [] })
      return
    }

    if (!allHealthRecords || allHealthRecords.length === 0) {
      console.log('没有健康记录数据')
      this.setData({ currentChartData: [] })
      return
    }

    // 确保 currentChartTypeIndex 有效（修复 undefined 问题）
    const validIndex = (currentChartTypeIndex !== undefined && currentChartTypeIndex >= 0 && currentChartTypeIndex < chartTypeOptions.length)
      ? currentChartTypeIndex
      : 0

    if (validIndex !== currentChartTypeIndex) {
      console.log('修正图表类型索引从', currentChartTypeIndex, '到', validIndex)
      this.setData({ currentChartTypeIndex: validIndex })
    }

    // 确保 chartTimeRange 是有效的数字字符串，修复 NaN 问题
    let validTimeRange = chartTimeRange
    if (!validTimeRange || isNaN(parseInt(validTimeRange))) {
      console.log('chartTimeRange 无效，重置为 7')
      validTimeRange = '7'
      this.setData({ chartTimeRange: '7' })
    }

    const currentType = chartTypeOptions[validIndex].type
    const days = parseInt(validTimeRange)

    console.log('当前选择的类型:', currentType)
    console.log('时间范围:', days, '天')

    const chartData = processHealthChartData(allHealthRecords, currentType, days)

    console.log('处理后的图表数据:', chartData)
    console.log('图表数据长度:', chartData.length)

    this.setData({ currentChartData: chartData })
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
