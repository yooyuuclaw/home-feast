// pages/health/health.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    todayDate: '',
    hasData: false,
    loading: true,

    // 当前标签页
    currentTab: 'health',

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

    // 吃药打卡数据
    medicineData: {
      medicines: []
    },
    showAddMedicineModal: false,
    showMedicineMenuModal: false,
    selectedMedicineId: '',
    newMedicine: {
      name: '',
      dosage: '',
      times: ['']
    },

    // 健康打卡数据
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
    selectedRecordId: '',

    // 授权管理
    showAuthModal: false,
    showAuthCodeModal: false,
    showInputAuthCodeModal: false,
    showViewSelectorModal: false,
    authCode: '',
    authCodeExpireTime: null,
    countdown: 0,
    countdownTimer: null,
    inputAuthCode: '',
    myAuthorizations: [],  // 我授权给他人的列表
    authorizedToMe: [],    // 授权我查看的列表
    currentViewingOpenid: null,  // 当前查看的用户openid（null表示查看自己）
    currentViewingNickname: '',  // 当前查看的用户昵称
    viewOptions: []  // 可查看的用户列表（包括自己）
  },

  onLoad() {
    this.checkPermission()
    this.setTodayDate()
    this.loadWaterGoal()
    this.loadAuthorizationLists()
  },

  onShow() {
    if (this.data.currentTab === 'health') {
      this.loadHealthData()
    } else if (this.data.currentTab === 'water') {
      this.loadWaterData()
    } else if (this.data.currentTab === 'medicine') {
      this.loadMedicineData()
    }
  },

  /**
   * 切换标签页
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })

    if (tab === 'health') {
      this.loadHealthData()
    } else if (tab === 'water') {
      this.loadWaterData()
    } else if (tab === 'medicine') {
      this.loadMedicineData()
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
   * 设置今天日期
   */
  setTodayDate() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    this.setData({
      todayDate: `${year}年${month}月${day}日`
    })
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

        // 使用全部数据计算各类型数量
        const counts = {
          weight: 0,
          bloodPressure: 0,
          bloodSugar: 0,
          bloodOxygen: 0,
          uricAcid: 0,
          height: 0
        }

        // 获取最新数据
        const latestData = {
          weight: '',
          bloodPressure: '',
          bloodSugar: '',
          bloodOxygen: '',
          uricAcid: '',
          height: ''
        }

        // 按类型分组，获取最新值（使用全部数据）
        const typeLatest = {}
        allRecords.forEach(record => {
          counts[record.type]++
          if (!typeLatest[record.type]) {
            typeLatest[record.type] = record
          }
        })

        // 填充最新数据
        Object.keys(typeLatest).forEach(type => {
          const record = typeLatest[type]
          latestData[type] = record.displayValue
        })

        // 处理记录显示 - 如果有筛选，使用筛选后的数据；否则使用全部数据
        const recordsToDisplay = this.data.currentFilter === 'all' ? allRecords : filteredRecords
        const recentRecords = recordsToDisplay.slice(0, 20).map(record => ({
          ...record,
          icon: this.getTypeIcon(record.type),
          typeName: this.getTypeName(record.type),
          dateStr: this.formatDate(record.recordDate)
        }))

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
   * 获取类型图标
   */
  getTypeIcon(type) {
    const iconMap = {
      weight: '⚖️',
      bloodPressure: '❤️',
      bloodOxygen: '💨',
      bloodSugar: '🩸',
      uricAcid: '💧',
      height: '📏'
    }
    return iconMap[type] || '📊'
  },

  /**
   * 获取类型名称
   */
  getTypeName(type) {
    const nameMap = {
      weight: '体重',
      bloodPressure: '血压',
      bloodOxygen: '血氧',
      bloodSugar: '血糖',
      uricAcid: '尿酸',
      height: '身高'
    }
    return nameMap[type] || type
  },

  /**
   * 格式化日期
   */
  formatDate(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const recordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    const diffDays = Math.floor((today - recordDate) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    } else if (diffDays === 1) {
      return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${month}-${day}`
    }
  },

  /**
   * 检查是否处于查看模式
   */
  checkViewMode() {
    if (this.data.currentViewingOpenid) {
      const messages = [
        '哎呀！您正在"云监工"模式呢 👀\n只能看不能动手哦~',
        '您现在是"吃瓜群众"身份 🍉\n围观可以，参与不行~',
        '温馨提示：您在看别人的数据呢 👓\n想操作的话，先切回自己吧！',
        '您现在是"隐形观察员" 🕵️\n这不是您的数据，不能随意改动哦~',
        '停停停！您在"参观模式" 🚶\n要添加记录请先回到自己的账号~'
      ]
      const randomMessage = messages[Math.floor(Math.random() * messages.length)]

      wx.showModal({
        title: '正在查看他人数据',
        content: randomMessage,
        showCancel: false,
        confirmText: '知道了'
      })
      return true
    }
    return false
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
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadHealthData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // ==================== 喝水打卡相关功能 ====================

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

      if (res.result.success) {
        const records = res.result.data || []
        const todayRecords = this.filterTodayRecords(records)
        const todayAmount = todayRecords.reduce((sum, item) => sum + item.amount, 0)
        const percent = Math.min(Math.round((todayAmount / this.data.waterData.goalAmount) * 100), 100)

        // 计算本周统计数据
        const weeklyStats = this.calculateWeeklyStats(records, this.data.waterData.goalAmount)

        // 计算连续打卡天数
        const streakDays = this.calculateStreakDays(records, this.data.waterData.goalAmount)

        this.setData({
          'waterData.todayRecords': todayRecords,
          'waterData.todayAmount': todayAmount,
          'waterData.weeklyStats': weeklyStats,
          'waterData.streakDays': streakDays,
          waterProgressPercent: percent
        })
      }
    } catch (err) {
      console.error('加载喝水数据失败', err)
    }
  },

  /**
   * 计算本周统计数据（最近7天）
   */
  calculateWeeklyStats(records, goalAmount) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 创建最近7天的日期映射
    const dailyAmounts = {}
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      dailyAmounts[dateStr] = 0
    }

    // 统计每天的饮水量
    records.forEach(record => {
      const dateStr = record.date.substring(0, 10)
      if (dailyAmounts.hasOwnProperty(dateStr)) {
        dailyAmounts[dateStr] += record.amount
      }
    })

    // 计算总量、平均量和达标天数
    const amounts = Object.values(dailyAmounts)
    const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0)
    const avgAmount = Math.round(totalAmount / 7)
    const completeDays = amounts.filter(amount => amount >= goalAmount).length

    return {
      totalAmount,
      avgAmount,
      completeDays
    }
  },

  /**
   * 计算连续打卡天数（从今天往前推）
   */
  calculateStreakDays(records, goalAmount) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 按日期分组统计每天的饮水量
    const dailyAmounts = {}
    records.forEach(record => {
      const dateStr = record.date.substring(0, 10)
      if (!dailyAmounts[dateStr]) {
        dailyAmounts[dateStr] = 0
      }
      dailyAmounts[dateStr] += record.amount
    })

    // 从今天开始往前检查连续打卡
    let streakDays = 0
    let checkDate = new Date(today)

    while (true) {
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`

      if (dailyAmounts[dateStr] && dailyAmounts[dateStr] >= goalAmount) {
        streakDays++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        // 如果检查的是今天且未达标，继续检查昨天
        if (streakDays === 0 && checkDate.getTime() === today.getTime()) {
          checkDate.setDate(checkDate.getDate() - 1)
          continue
        }
        break
      }
    }

    return streakDays
  },

  /**
   * 筛选今日记录
   */
  filterTodayRecords(records) {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    return records
      .filter(record => record.date.startsWith(todayStr))
      .map(record => ({
        ...record,
        time: record.date.substring(11, 16) // 提取时间部分
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
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
  },

  // ==================== 吃药打卡相关功能 ====================

  /**
   * 加载药品数据
   */
  async loadMedicineData() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'getMedicines',
          targetOpenid: this.data.currentViewingOpenid
        }
      })

      if (res.result.success) {
        const medicines = res.result.data || []
        // 处理今日服用状态
        medicines.forEach(medicine => {
          medicine.todayTaken = medicine.times.every(t => t.taken)
        })

        this.setData({
          'medicineData.medicines': medicines
        })
      }
    } catch (err) {
      console.error('加载药品数据失败', err)
    }
  },

  /**
   * 显示添加药品弹窗
   */
  showAddMedicine() {
    if (this.checkViewMode()) return

    this.setData({
      showAddMedicineModal: true,
      newMedicine: {
        name: '',
        dosage: '',
        times: ['']
      }
    })
  },

  /**
   * 隐藏添加药品弹窗
   */
  hideAddMedicine() {
    this.setData({ showAddMedicineModal: false })
  },

  /**
   * 药品名称输入
   */
  onMedicineNameInput(e) {
    this.setData({ 'newMedicine.name': e.detail.value })
  },

  /**
   * 药品剂量输入
   */
  onMedicineDosageInput(e) {
    this.setData({ 'newMedicine.dosage': e.detail.value })
  },

  /**
   * 服用时间改变
   */
  onMedicineTimeChange(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    this.setData({
      [`newMedicine.times[${index}]`]: value
    })
  },

  /**
   * 添加服用时间
   */
  addMedicineTime() {
    const times = this.data.newMedicine.times
    times.push('')
    this.setData({ 'newMedicine.times': times })
  },

  /**
   * 移除服用时间
   */
  removeMedicineTime(e) {
    const index = e.currentTarget.dataset.index
    const times = this.data.newMedicine.times
    if (times.length > 1) {
      times.splice(index, 1)
      this.setData({ 'newMedicine.times': times })
    }
  },

  /**
   * 保存药品
   */
  async saveMedicine() {
    const { name, dosage, times } = this.data.newMedicine

    if (!name) {
      wx.showToast({ title: '请输入药品名称', icon: 'none' })
      return
    }

    if (!dosage) {
      wx.showToast({ title: '请输入服用剂量', icon: 'none' })
      return
    }

    const validTimes = times.filter(t => t)
    if (validTimes.length === 0) {
      wx.showToast({ title: '请至少添加一个服用时间', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })

      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'addMedicine',
          name: name,
          dosage: dosage,
          times: validTimes
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.setData({ showAddMedicineModal: false })
        this.loadMedicineData()
      } else {
        wx.showToast({ title: res.result.message || '保存失败', icon: 'none' })
      }
    } catch (err) {
      console.error('保存药品失败', err)
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  /**
   * 切换服药状态
   */
  async toggleMedicineTaken(e) {
    if (this.checkViewMode()) return

    const medicineId = e.currentTarget.dataset.medicineId
    const timeIndex = e.currentTarget.dataset.timeIndex

    try {
      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'toggleMedicineTaken',
          medicineId: medicineId,
          timeIndex: timeIndex
        }
      })

      if (res.result.success) {
        this.loadMedicineData()
      } else {
        wx.showToast({ title: res.result.message || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.error('切换服药状态失败', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  /**
   * 显示药品菜单
   */
  showMedicineMenu(e) {
    if (this.checkViewMode()) return

    const id = e.currentTarget.dataset.id
    this.setData({
      showMedicineMenuModal: true,
      selectedMedicineId: id
    })
  },

  /**
   * 隐藏药品菜单
   */
  hideMedicineMenu() {
    this.setData({
      showMedicineMenuModal: false,
      selectedMedicineId: ''
    })
  },

  /**
   * 删除药品
   */
  async deleteMedicine() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个药品提醒吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })

            const result = await wx.cloud.callFunction({
              name: 'health',
              data: {
                action: 'deleteMedicine',
                id: this.data.selectedMedicineId
              }
            })

            wx.hideLoading()

            if (result.result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              this.setData({ showMedicineMenuModal: false })
              this.loadMedicineData()
            } else {
              wx.showToast({ title: result.result.message || '删除失败', icon: 'none' })
            }
          } catch (err) {
            console.error('删除药品失败', err)
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // ==================== 授权管理相关功能 ====================

  /**
   * 显示授权管理弹窗
   */
  async showAuthManagement() {
    await this.loadAuthorizationLists()
    this.setData({ showAuthModal: true })
  },

  /**
   * 隐藏授权管理弹窗
   */
  hideAuthManagement() {
    this.setData({ showAuthModal: false })
  },

  /**
   * 加载授权列表
   */
  async loadAuthorizationLists() {
    try {
      // 加载我授权给他人的列表
      const myAuthRes = await wx.cloud.callFunction({
        name: 'health',
        data: { action: 'getMyAuthorizations' }
      })

      // 加载授权我查看的列表
      const authorizedRes = await wx.cloud.callFunction({
        name: 'health',
        data: { action: 'getAuthorizedToMe' }
      })

      const myAuthorizations = myAuthRes.result.data || []
      const authorizedToMe = authorizedRes.result.data || []

      // 构建可查看的用户列表
      const viewOptions = [
        { openid: null, nickname: '我自己' }
      ]

      authorizedToMe.forEach(auth => {
        viewOptions.push({
          openid: auth.owner_openid,
          nickname: auth.owner_nickname
        })
      })

      this.setData({
        myAuthorizations,
        authorizedToMe,
        viewOptions
      })
    } catch (err) {
      console.error('加载授权列表失败', err)
    }
  },

  /**
   * 生成授权码
   */
  async generateAuthCode() {
    try {
      wx.showLoading({ title: '生成中...' })

      const res = await wx.cloud.callFunction({
        name: 'health',
        data: { action: 'generateAuthCode' }
      })

      wx.hideLoading()

      if (res.result.success) {
        const expireTime = new Date(res.result.data.expireTime)
        const now = new Date()
        const countdown = Math.floor((expireTime - now) / 1000)

        this.setData({
          showAuthCodeModal: true,
          authCode: res.result.data.code,
          authCodeExpireTime: expireTime,
          countdown: countdown
        })

        // 启动倒计时
        this.startCountdown()
      } else {
        wx.showToast({
          title: res.result.message || '生成失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('生成授权码失败', err)
      wx.hideLoading()
      wx.showToast({ title: '生成失败', icon: 'none' })
    }
  },

  /**
   * 启动倒计时
   */
  startCountdown() {
    if (this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer)
    }

    const timer = setInterval(() => {
      const countdown = this.data.countdown - 1
      if (countdown <= 0) {
        clearInterval(timer)
        this.setData({
          countdown: 0,
          showAuthCodeModal: false
        })
      } else {
        this.setData({ countdown })
      }
    }, 1000)

    this.setData({ countdownTimer: timer })
  },

  /**
   * 关闭授权码弹窗
   */
  hideAuthCodeModal() {
    if (this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer)
      this.setData({ countdownTimer: null })
    }
    this.setData({ showAuthCodeModal: false })
  },

  /**
   * 显示输入授权码弹窗
   */
  showInputAuthCode() {
    this.setData({
      showInputAuthCodeModal: true,
      inputAuthCode: ''
    })
  },

  /**
   * 隐藏输入授权码弹窗
   */
  hideInputAuthCode() {
    this.setData({ showInputAuthCodeModal: false })
  },

  /**
   * 授权码输入
   */
  onAuthCodeInput(e) {
    this.setData({ inputAuthCode: e.detail.value })
  },

  /**
   * 使用授权码
   */
  async useAuthCode() {
    const code = this.data.inputAuthCode.trim()

    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位授权码', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '验证中...' })

      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'useAuthCode',
          code: code
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({ title: res.result.message, icon: 'success' })
        this.setData({ showInputAuthCodeModal: false })
        // 重新加载授权列表
        await this.loadAuthorizationLists()
      } else {
        wx.showToast({
          title: res.result.message || '授权失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('使用授权码失败', err)
      wx.hideLoading()
      wx.showToast({ title: '授权失败', icon: 'none' })
    }
  },

  /**
   * 撤销授权
   */
  async revokeAuthorization(e) {
    const authId = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认撤销',
      content: '撤销后对方将无法继续查看您的健康数据',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '撤销中...' })

            const result = await wx.cloud.callFunction({
              name: 'health',
              data: {
                action: 'revokeAuthorization',
                authId: authId
              }
            })

            wx.hideLoading()

            if (result.result.success) {
              wx.showToast({ title: '已撤销授权', icon: 'success' })
              await this.loadAuthorizationLists()
            } else {
              wx.showToast({
                title: result.result.message || '撤销失败',
                icon: 'none'
              })
            }
          } catch (err) {
            console.error('撤销授权失败', err)
            wx.hideLoading()
            wx.showToast({ title: '撤销失败', icon: 'none' })
          }
        }
      }
    })
  },

  /**
   * 显示查看人员选择器
   */
  showViewSelector() {
    this.setData({ showViewSelectorModal: true })
  },

  /**
   * 隐藏查看人员选择器
   */
  hideViewSelector() {
    this.setData({ showViewSelectorModal: false })
  },

  /**
   * 选择查看对象
   */
  async selectViewTarget(e) {
    const openid = e.currentTarget.dataset.openid
    const nickname = e.currentTarget.dataset.nickname

    this.setData({
      currentViewingOpenid: openid,
      currentViewingNickname: nickname,
      showViewSelectorModal: false
    })

    // 重新加载当前标签页的数据
    if (this.data.currentTab === 'health') {
      await this.loadHealthData()
    } else if (this.data.currentTab === 'water') {
      await this.loadWaterData()
    } else if (this.data.currentTab === 'medicine') {
      await this.loadMedicineData()
    }
  }
})
