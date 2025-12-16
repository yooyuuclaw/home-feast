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
    customWaterAmount: '',

    // 拍照打卡相关
    showPhotoOptions: false,      // 显示拍照选项弹窗
    pendingWaterAmount: 0,        // 待记录的饮水量
    tempPhotoPath: '',            // 临时照片路径
    showPhotoWall: false,         // 显示照片墙
    hasPhotoRecords: false,       // 是否有拍照记录
    waterChartData: []            // 近一个月饮水图表数据
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

        // 检查是否有拍照记录
        const hasPhotoRecords = todayRecords.some(record => record.hasPhoto && record.photoPath)

        // 处理近一个月图表数据
        const waterChartData = this.processWaterChartData(records)

        this.setData({
          'waterData.todayRecords': todayRecords,
          'waterData.todayAmount': todayAmount,
          'waterData.weeklyStats': weeklyStats,
          'waterData.streakDays': streakDays,
          waterProgressPercent: percent,
          hasPhotoRecords: hasPhotoRecords,
          waterChartData: waterChartData
        })
      } else {
        console.error('加载喝水数据失败:', res.result ? res.result.message : '未知错误')
      }
    } catch (err) {
      console.error('加载喝水数据失败', err)
    }
  },

  /**
   * 添加喝水记录（显示拍照选项弹窗）
   */
  addWater(e) {
    if (this.checkViewMode()) return

    const amount = parseInt(e.currentTarget.dataset.amount)

    // 显示拍照选项弹窗
    this.setData({
      showPhotoOptions: true,
      pendingWaterAmount: amount,
      tempPhotoPath: ''
    })
  },

  /**
   * 隐藏拍照选项弹窗
   */
  hidePhotoOptions() {
    this.setData({
      showPhotoOptions: false,
      pendingWaterAmount: 0,
      tempPhotoPath: ''
    })
  },

  /**
   * 拍照打卡
   */
  async takePhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera'], // 只允许拍照
        sizeType: ['compressed'], // 压缩图
        camera: 'back' // 后置摄像头
      })

      if (res.tempFiles && res.tempFiles.length > 0) {
        const tempFilePath = res.tempFiles[0].tempFilePath

        // 保存到本地永久存储
        const saveRes = await wx.saveFile({
          tempFilePath: tempFilePath
        })

        const savedFilePath = saveRes.savedFilePath

        this.setData({
          tempPhotoPath: savedFilePath
        })

        // 自动提交记录
        this.submitWaterRecord()
      }
    } catch (err) {
      console.error('拍照失败', err)
      if (err.errMsg && !err.errMsg.includes('cancel')) {
        wx.showToast({ title: '拍照失败', icon: 'none' })
      }
    }
  },

  /**
   * 选择相册照片
   */
  async choosePhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'], // 只允许相册
        sizeType: ['compressed'] // 压缩图，避免文件过大
      })

      if (res.tempFiles && res.tempFiles.length > 0) {
        const tempFile = res.tempFiles[0]
        const tempFilePath = tempFile.tempFilePath

        // 简单友好的确认，不需要上传到云端验证
        const confirmRes = await new Promise(resolve => {
          wx.showModal({
            title: '📷 确认打卡照片',
            content: '请确认：这张照片是今天拍的吗？\n\n💡 小提示：为了记录更准确，建议使用今天拍摄的照片哦～',
            confirmText: '是今天的',
            confirmColor: '#2196F3',
            cancelText: '不是',
            success: (res) => resolve(res.confirm)
          })
        })

        if (!confirmRes) {
          // 用户确认不是今天的照片，显示幽默提示
          const tips = [
            '那就再拍一张新鲜的吧！📸 今天的打卡要用今天的照片哦～',
            '时光倒流失败！⏰ 换一张今天的照片试试？',
            '我们只接受"新鲜出炉"的打卡照！🔥 重新拍一张吧～',
            '要不现在拍一张？今天的打卡就要今天的照片！✨'
          ]
          const randomTip = tips[Math.floor(Math.random() * tips.length)]

          wx.showToast({
            title: randomTip,
            icon: 'none',
            duration: 2500
          })
          return
        }

        // 用户确认是今天的照片，保存并提交
        try {
          const saveRes = await wx.saveFile({
            tempFilePath: tempFilePath
          })

          const savedFilePath = saveRes.savedFilePath

          this.setData({
            tempPhotoPath: savedFilePath
          })

          // 自动提交记录
          this.submitWaterRecord()
        } catch (saveErr) {
          console.error('保存照片失败:', saveErr)
          wx.showToast({ title: '保存照片失败', icon: 'none' })
        }
      }
    } catch (err) {
      console.error('选择照片失败', err)
      if (err.errMsg && !err.errMsg.includes('cancel')) {
        wx.showToast({ title: '选择照片失败', icon: 'none' })
      }
    }
  },

  /**
   * 跳过拍照，直接记录
   */
  skipPhoto() {
    this.submitWaterRecord()
  },

  /**
   * 提交喝水记录
   */
  async submitWaterRecord() {
    const amount = this.data.pendingWaterAmount
    const photoPath = this.data.tempPhotoPath

    this.setData({ showPhotoOptions: false })

    try {
      wx.showLoading({ title: '记录中...' })

      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'addWaterRecord',
          amount: amount,
          photoPath: photoPath || null,
          hasPhoto: !!photoPath
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: photoPath ? '拍照打卡成功' : '记录成功',
          icon: 'success'
        })
        this.loadWaterData()

        // 重置状态
        this.setData({
          pendingWaterAmount: 0,
          tempPhotoPath: ''
        })
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
  confirmCustomWater() {
    const amount = parseInt(this.data.customWaterAmount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效的水量', icon: 'none' })
      return
    }

    // 关闭自定义水量弹窗，显示拍照选项弹窗
    this.setData({
      showCustomWaterModal: false,
      showPhotoOptions: true,
      pendingWaterAmount: amount,
      tempPhotoPath: ''
    })
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
  },

  /**
   * 预览照片
   */
  previewPhoto(e) {
    const photoPath = e.currentTarget.dataset.photo
    if (!photoPath) {
      wx.showToast({ title: '该记录无照片', icon: 'none' })
      return
    }

    wx.previewImage({
      urls: [photoPath],
      current: photoPath
    })
  },

  /**
   * 显示照片墙
   */
  showPhotoWall() {
    // 收集所有有照片的记录
    const photosRecords = this.data.waterData.todayRecords.filter(record => record.hasPhoto && record.photoPath)

    if (photosRecords.length === 0) {
      wx.showToast({ title: '还没有拍照记录哦', icon: 'none' })
      return
    }

    this.setData({ showPhotoWall: true })
  },

  /**
   * 隐藏照片墙
   */
  hidePhotoWall() {
    this.setData({ showPhotoWall: false })
  },

  /**
   * 照片墙中预览照片
   */
  previewPhotoInWall(e) {
    const index = e.currentTarget.dataset.index
    const photosRecords = this.data.waterData.todayRecords.filter(record => record.hasPhoto && record.photoPath)
    const urls = photosRecords.map(record => record.photoPath)

    wx.previewImage({
      urls: urls,
      current: urls[index]
    })
  }
,

  /**
   * 处理饮水图表数据（近30天）
   */
  processWaterChartData(records) {
    if (!records || records.length === 0) {
      return []
    }

    const now = new Date()
    const chartData = []
    const dailyData = {}

    // 初始化近30天的数据（使用东八区时间）
    const offset = 8 * 60 // 东八区偏移量（分钟）
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const localTime = new Date(date.getTime() + offset * 60 * 1000)
      const year = localTime.getUTCFullYear()
      const month = String(localTime.getUTCMonth() + 1).padStart(2, '0')
      const day = String(localTime.getUTCDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      dailyData[dateStr] = 0
    }

    // 统计每天的饮水量
    records.forEach(record => {
      // record.date 格式为 "YYYY-MM-DD HH:mm:ss"
      const recordDate = record.date.substring(0, 10)
      if (dailyData.hasOwnProperty(recordDate)) {
        dailyData[recordDate] += record.amount
      }
    })

    // 转换为图表数据格式 - 保持 YYYY-MM-DD 格式，让图表组件自己处理
    Object.keys(dailyData).sort().forEach(dateStr => {
      chartData.push({
        date: dateStr,  // 保持 YYYY-MM-DD 格式
        value: dailyData[dateStr]
      })
    })

    return chartData
  }
}
