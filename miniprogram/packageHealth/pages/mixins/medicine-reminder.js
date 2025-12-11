/**
 * 吃药提醒功能模块
 */

export default {
  data: {
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
    }
  },

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

      if (res.result && res.result.success) {
        const medicines = res.result.data || []
        // 处理今日服用状态
        medicines.forEach(medicine => {
          medicine.todayTaken = medicine.times.every(t => t.taken)
        })

        this.setData({
          'medicineData.medicines': medicines
        })
      } else {
        console.error('加载药品数据失败:', res.result ? res.result.message : '未知错误')
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
  }
}
