// pages/health/health-add/health-add.js
const app = getApp()

Page({
  data: {
    selectedType: 'weight',
    healthTypes: [
      { name: '体重', value: 'weight', icon: '⚖️' },
      { name: '身高', value: 'height', icon: '📏' },
      { name: '血压', value: 'bloodPressure', icon: '❤️' },
      { name: '血氧', value: 'bloodOxygen', icon: '💨' },
      { name: '血糖', value: 'bloodSugar', icon: '🩸' },
      { name: '尿酸', value: 'uricAcid', icon: '💧' }
    ],

    // 日期时间
    recordDate: '',
    recordTime: '',

    // 输入值
    inputValues: {
      weight: '',
      height: '',
      systolic: '',
      diastolic: '',
      bloodOxygen: '',
      bloodSugar: '',
      uricAcid: ''
    },

    // 血糖测量时机
    bloodSugarTimes: ['空腹', '餐后1小时', '餐后2小时', '睡前', '随机'],
    bloodSugarTimeIndex: 0,

    // 备注
    note: ''
  },

  onLoad() {
    this.initDateTime()
  },

  /**
   * 初始化日期时间
   */
  initDateTime() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')

    this.setData({
      recordDate: `${year}-${month}-${day}`,
      recordTime: `${hour}:${minute}`
    })
  },

  /**
   * 选择指标类型
   */
  selectType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ selectedType: type })
  },

  /**
   * 日期改变
   */
  onDateChange(e) {
    this.setData({ recordDate: e.detail.value })
  },

  /**
   * 时间改变
   */
  onTimeChange(e) {
    this.setData({ recordTime: e.detail.value })
  },

  /**
   * 输入改变
   */
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`inputValues.${field}`]: e.detail.value
    })
  },

  /**
   * 血糖测量时机改变
   */
  onBloodSugarTimeChange(e) {
    this.setData({ bloodSugarTimeIndex: parseInt(e.detail.value) })
  },

  /**
   * 备注输入
   */
  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  /**
   * 验证输入
   */
  validateInput() {
    const { selectedType, inputValues } = this.data

    switch (selectedType) {
      case 'weight':
        if (!inputValues.weight || parseFloat(inputValues.weight) <= 0) {
          wx.showToast({ title: '请输入有效的体重', icon: 'none' })
          return false
        }
        if (parseFloat(inputValues.weight) > 500) {
          wx.showToast({ title: '体重数值过大', icon: 'none' })
          return false
        }
        break

      case 'height':
        if (!inputValues.height || parseFloat(inputValues.height) <= 0) {
          wx.showToast({ title: '请输入有效的身高', icon: 'none' })
          return false
        }
        if (parseFloat(inputValues.height) > 300) {
          wx.showToast({ title: '身高数值过大', icon: 'none' })
          return false
        }
        break

      case 'bloodPressure':
        if (!inputValues.systolic || !inputValues.diastolic) {
          wx.showToast({ title: '请输入收缩压和舒张压', icon: 'none' })
          return false
        }
        if (parseInt(inputValues.systolic) <= parseInt(inputValues.diastolic)) {
          wx.showToast({ title: '收缩压应大于舒张压', icon: 'none' })
          return false
        }
        break

      case 'bloodOxygen':
        if (!inputValues.bloodOxygen || parseFloat(inputValues.bloodOxygen) <= 0) {
          wx.showToast({ title: '请输入有效的血氧值', icon: 'none' })
          return false
        }
        if (parseFloat(inputValues.bloodOxygen) > 100) {
          wx.showToast({ title: '血氧值不能超过100%', icon: 'none' })
          return false
        }
        break

      case 'bloodSugar':
        if (!inputValues.bloodSugar || parseFloat(inputValues.bloodSugar) <= 0) {
          wx.showToast({ title: '请输入有效的血糖值', icon: 'none' })
          return false
        }
        break

      case 'uricAcid':
        if (!inputValues.uricAcid || parseFloat(inputValues.uricAcid) <= 0) {
          wx.showToast({ title: '请输入有效的尿酸值', icon: 'none' })
          return false
        }
        break
    }

    return true
  },

  /**
   * 构建保存数据
   */
  buildSaveData() {
    const { selectedType, inputValues, recordDate, recordTime, note, bloodSugarTimes, bloodSugarTimeIndex } = this.data
    const recordDateTime = `${recordDate} ${recordTime}:00`

    let value = ''
    let displayValue = ''

    switch (selectedType) {
      case 'weight':
        value = inputValues.weight
        displayValue = `${value} kg`
        break

      case 'height':
        value = inputValues.height
        displayValue = `${value} cm`
        break

      case 'bloodPressure':
        value = `${inputValues.systolic}/${inputValues.diastolic}`
        displayValue = `${value} mmHg`
        break

      case 'bloodOxygen':
        value = inputValues.bloodOxygen
        displayValue = `${value}%`
        break

      case 'bloodSugar':
        value = inputValues.bloodSugar
        displayValue = `${value} mmol/L (${bloodSugarTimes[bloodSugarTimeIndex]})`
        break

      case 'uricAcid':
        value = inputValues.uricAcid
        displayValue = `${value} μmol/L`
        break
    }

    return {
      type: selectedType,
      value: value,
      displayValue: displayValue,
      recordDate: recordDateTime,
      note: note || '',
      extra: selectedType === 'bloodSugar' ? { timing: bloodSugarTimes[bloodSugarTimeIndex] } : {}
    }
  },

  /**
   * 保存
   */
  async save() {
    if (!this.validateInput()) {
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })

      const data = this.buildSaveData()

      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'add',
          ...data
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })

        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: res.result.message || '保存失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('保存健康记录失败', err)
      wx.hideLoading()
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  /**
   * 取消
   */
  cancel() {
    wx.navigateBack()
  }
})
