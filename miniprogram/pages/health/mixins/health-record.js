/**
 * 健康打卡功能模块
 */

import { formatRelativeDate } from '../utils/date-formatter.js'
import { processHealthRecords } from '../utils/data-calculator.js'
import { getTypeIcon, getTypeName } from '../utils/type-helper.js'

export default {
  data: {
    hasData: false,

    // 最新数据
    latestData: {
      weight: '',
      bloodPressure: '',
      bloodSugar: '',
      bloodOxygen: '',
      uricAcid: '',
      height: ''
    },

    // 各类型记录数量
    counts: {
      weight: 0,
      bloodPressure: 0,
      bloodSugar: 0,
      bloodOxygen: 0,
      uricAcid: 0,
      height: 0
    },

    // 最近记录
    recentRecords: [],

    // 筛选相关
    showFilterModal: false,
    currentFilter: 'all',
    filterText: '全部',
    filterOptions: [
      { label: '全部', value: 'all' },
      { label: '体重', value: 'weight' },
      { label: '血压', value: 'bloodPressure' },
      { label: '血氧', value: 'bloodOxygen' },
      { label: '血糖', value: 'bloodSugar' },
      { label: '尿酸', value: 'uricAcid' },
      { label: '身高', value: 'height' }
    ],

    // 记录菜单
    showRecordMenu: false,
    selectedRecordId: ''
  },

  /**
   * 加载健康数据
   */
  async loadHealthData() {
    try {
      this.setData({ loading: true })

      // 始终加载全部数据用于统计健康指标
      const allDataRes = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'list',
          filter: null,  // 不筛选，获取全部数据
          targetOpenid: this.data.currentViewingOpenid
        }
      })

      // 如果有筛选条件，再加载筛选后的数据用于显示最近记录
      let filteredRecords = []
      if (this.data.currentFilter !== 'all') {
        const filteredRes = await wx.cloud.callFunction({
          name: 'health',
          data: {
            action: 'list',
            filter: this.data.currentFilter,
            targetOpenid: this.data.currentViewingOpenid
          }
        })
        if (filteredRes.result.success) {
          filteredRecords = filteredRes.result.data || []
        }
      }

      if (allDataRes.result.success) {
        const allRecords = allDataRes.result.data || []

        // 使用工具函数计算各类型数量和最新值
        const { counts, latestData } = processHealthRecords(allRecords)

        // 处理记录显示 - 如果有筛选，使用筛选后的数据；否则使用全部数据
        const recordsToDisplay = this.data.currentFilter === 'all' ? allRecords : filteredRecords
        const recentRecords = this._formatRecentRecords(recordsToDisplay)

        this.setData({
          recentRecords,
          counts,  // 始终使用全部数据的统计
          latestData,  // 始终使用全部数据的最新值
          hasData: allRecords.length > 0,
          loading: false
        })
      }
    } catch (err) {
      console.error('加载健康数据失败', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 格式化最近记录
   * @private
   */
  _formatRecentRecords(records) {
    return records.slice(0, 20).map(record => ({
      ...record,
      icon: getTypeIcon(record.type),
      typeName: getTypeName(record.type),
      dateStr: formatRelativeDate(record.recordDate)
    }))
  },

  /**
   * 跳转到添加记录页面
   */
  goToAdd() {
    if (this.checkViewMode()) return

    wx.navigateTo({
      url: '/pages/health/health-add/health-add'
    })
  },

  /**
   * 查看详情（按类型）
   */
  viewDetails(e) {
    const type = e.currentTarget.dataset.type
    // 暂时使用筛选功能代替
    const option = this.data.filterOptions.find(opt => opt.value === type)
    if (option) {
      this.setData({
        currentFilter: type,
        filterText: option.label
      })
      this.loadHealthData()
    }
  },

  /**
   * 显示筛选器
   */
  showFilterPicker() {
    this.setData({ showFilterModal: true })
  },

  /**
   * 隐藏筛选器
   */
  hideFilterPicker() {
    this.setData({ showFilterModal: false })
  },

  /**
   * 选择筛选条件
   */
  selectFilter(e) {
    const value = e.currentTarget.dataset.value
    const option = this.data.filterOptions.find(opt => opt.value === value)

    this.setData({
      currentFilter: value,
      filterText: option.label,
      showFilterModal: false
    })

    this.loadHealthData()
  },

  /**
   * 显示记录菜单
   */
  showRecordMenu(e) {
    if (this.checkViewMode()) return

    const id = e.currentTarget.dataset.id
    this.setData({
      showRecordMenu: true,
      selectedRecordId: id
    })
  },

  /**
   * 隐藏记录菜单
   */
  hideRecordMenu() {
    this.setData({
      showRecordMenu: false,
      selectedRecordId: ''
    })
  },

  /**
   * 删除记录
   */
  async deleteRecord() {
    const that = this
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })

            const result = await wx.cloud.callFunction({
              name: 'health',
              data: {
                action: 'delete',
                id: that.data.selectedRecordId
              }
            })

            wx.hideLoading()

            if (result.result.success) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
              that.setData({ showRecordMenu: false })
              that.loadHealthData()
            } else {
              wx.showToast({
                title: result.result.message || '删除失败',
                icon: 'none'
              })
            }
          } catch (err) {
            console.error('删除记录失败', err)
            wx.hideLoading()
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  }
}
