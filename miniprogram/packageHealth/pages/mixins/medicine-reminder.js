/**
 * 吃药提醒功能模块
 */

export default {
  data: {
    // 吃药打卡数据
    medicineData: {
      medicines: [],
      todayRecords: [] // 今日服药记录
    },
    showAddMedicineModal: false,
    showMedicineMenuModal: false,
    selectedMedicineId: '',
    newMedicine: {
      name: '',
      dosage: '',
      times: ['']
    },

    // 拍照打卡相关
    showMedicinePhotoOptions: false,  // 显示拍照选项弹窗
    pendingMedicineData: null,        // 待记录的服药数据 {medicineId, timeIndex, medicineName, time}
    tempMedicinePhotoPath: '',        // 临时照片路径
    showMedicinePhotoWall: false,     // 显示照片墙
    hasMedicinePhotoRecords: false    // 是否有拍照记录
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

        // 加载今日服药记录
        this.loadMedicineTodayRecords()
      } else {
        console.error('加载药品数据失败:', res.result ? res.result.message : '未知错误')
      }
    } catch (err) {
      console.error('加载药品数据失败', err)
    }
  },

  /**
   * 加载今日服药记录
   */
  async loadMedicineTodayRecords() {
    try {
      console.log('[loadMedicineTodayRecords] 开始加载今日服药记录')
      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'getMedicineTodayRecords',
          targetOpenid: this.data.currentViewingOpenid
        }
      })

      console.log('[loadMedicineTodayRecords] 云函数返回结果:', res)

      if (res.result && res.result.success) {
        const records = res.result.data || []
        console.log('[loadMedicineTodayRecords] 成功获取记录:', records.length, '条')

        // 检查是否有拍照记录
        const hasPhotoRecords = records.some(record => record.hasPhoto && record.photoPath)

        this.setData({
          'medicineData.todayRecords': records,
          hasMedicinePhotoRecords: hasPhotoRecords
        })
      } else {
        console.error('[loadMedicineTodayRecords] 加载服药记录失败:', res.result ? res.result.message : '未知错误')
        console.error('[loadMedicineTodayRecords] 完整结果:', res)
      }
    } catch (err) {
      console.error('[loadMedicineTodayRecords] 加载服药记录异常', err)
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
   * 切换服药状态（添加拍照功能）
   */
  async toggleMedicineTaken(e) {
    if (this.checkViewMode()) return

    const medicineId = e.currentTarget.dataset.medicineId
    const timeIndex = e.currentTarget.dataset.timeIndex

    // 查找对应的药品和时间信息
    const medicine = this.data.medicineData.medicines.find(m => m._id === medicineId)
    if (!medicine) return

    const timeItem = medicine.times[timeIndex]
    const isTaken = timeItem.taken

    // 如果是从未服用到已服用，显示拍照选项
    if (!isTaken) {
      this.setData({
        showMedicinePhotoOptions: true,
        pendingMedicineData: {
          medicineId: medicineId,
          timeIndex: timeIndex,
          medicineName: medicine.name,
          time: timeItem.time
        },
        tempMedicinePhotoPath: ''
      })
    } else {
      // 如果是取消服药，直接调用云函数
      this.submitMedicineRecord(medicineId, timeIndex, null, false)
    }
  },

  /**
   * 隐藏拍照选项弹窗
   */
  hideMedicinePhotoOptions() {
    this.setData({
      showMedicinePhotoOptions: false,
      pendingMedicineData: null,
      tempMedicinePhotoPath: ''
    })
  },

  /**
   * 拍照打卡（服药）
   */
  async takeMedicinePhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera'],
        sizeType: ['compressed'],
        camera: 'back'
      })

      if (res.tempFiles && res.tempFiles.length > 0) {
        const tempFilePath = res.tempFiles[0].tempFilePath

        const saveRes = await wx.saveFile({
          tempFilePath: tempFilePath
        })

        const savedFilePath = saveRes.savedFilePath

        this.setData({
          tempMedicinePhotoPath: savedFilePath
        })

        // 自动提交记录
        this.submitMedicineRecord(
          this.data.pendingMedicineData.medicineId,
          this.data.pendingMedicineData.timeIndex,
          savedFilePath,
          true
        )
      }
    } catch (err) {
      console.error('拍照失败', err)
      if (err.errMsg && !err.errMsg.includes('cancel')) {
        wx.showToast({ title: '拍照失败', icon: 'none' })
      }
    }
  },

  /**
   * 选择相册照片（服药）
   */
  async chooseMedicinePhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['compressed']
      })

      if (res.tempFiles && res.tempFiles.length > 0) {
        const tempFile = res.tempFiles[0]
        const tempFilePath = tempFile.tempFilePath

        // 简单友好的确认
        const confirmRes = await new Promise(resolve => {
          wx.showModal({
            title: '📷 确认打卡照片',
            content: '请确认：这张照片是今天拍的吗？\n\n💡 小提示：为了记录更准确，建议使用今天拍摄的照片哦～',
            confirmText: '是今天的',
            confirmColor: '#9C27B0',
            cancelText: '不是',
            success: (res) => resolve(res.confirm)
          })
        })

        if (!confirmRes) {
          const tips = [
            '那就再拍一张新鲜的吧！📸 今天的打卡要用今天的照片哦～',
            '时光倒流失败！⏰ 换一张今天的照片试试？',
            '我们只接受"新鲜出炉"的打卡照！🔥 重新拍一张吧～',
            '要不现在拍一张？今天的打卡就要今天的照片！✨'
          ]
          const randomTip = tips[Math.floor(Math.random() * tips.length)]
          wx.showToast({ title: randomTip, icon: 'none', duration: 2500 })
          return
        }

        // 保存照片
        try {
          const saveRes = await wx.saveFile({
            tempFilePath: tempFilePath
          })

          const savedFilePath = saveRes.savedFilePath

          this.setData({
            tempMedicinePhotoPath: savedFilePath
          })

          // 自动提交记录
          this.submitMedicineRecord(
            this.data.pendingMedicineData.medicineId,
            this.data.pendingMedicineData.timeIndex,
            savedFilePath,
            true
          )
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
  skipMedicinePhoto() {
    this.submitMedicineRecord(
      this.data.pendingMedicineData.medicineId,
      this.data.pendingMedicineData.timeIndex,
      null,
      false
    )
  },

  /**
   * 提交服药记录
   */
  async submitMedicineRecord(medicineId, timeIndex, photoPath, hasPhoto) {
    this.setData({ showMedicinePhotoOptions: false })

    try {
      wx.showLoading({ title: '记录中...' })

      console.log('[submitMedicineRecord] 提交参数:', { medicineId, timeIndex, photoPath, hasPhoto })

      const res = await wx.cloud.callFunction({
        name: 'health',
        data: {
          action: 'toggleMedicineTaken',
          medicineId: medicineId,
          timeIndex: timeIndex,
          photoPath: photoPath || null,
          hasPhoto: hasPhoto || false
        }
      })

      console.log('[submitMedicineRecord] 云函数返回结果:', res)

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: photoPath ? '拍照打卡成功' : '记录成功',
          icon: 'success'
        })
        this.loadMedicineData()
        this.loadMedicineTodayRecords()

        // 重置状态
        this.setData({
          pendingMedicineData: null,
          tempMedicinePhotoPath: ''
        })
      } else {
        console.error('[submitMedicineRecord] 操作失败:', res.result.message)
        wx.showToast({ title: res.result.message || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[submitMedicineRecord] 切换服药状态异常:', err)
      wx.hideLoading()
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  /**
   * 预览照片
   */
  previewMedicinePhoto(e) {
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
  showMedicinePhotoWall() {
    const photosRecords = this.data.medicineData.todayRecords.filter(record => record.hasPhoto && record.photoPath)

    if (photosRecords.length === 0) {
      wx.showToast({ title: '还没有拍照记录哦', icon: 'none' })
      return
    }

    this.setData({ showMedicinePhotoWall: true })
  },

  /**
   * 隐藏照片墙
   */
  hideMedicinePhotoWall() {
    this.setData({ showMedicinePhotoWall: false })
  },

  /**
   * 照片墙中预览照片
   */
  previewMedicinePhotoInWall(e) {
    const index = e.currentTarget.dataset.index
    const photosRecords = this.data.medicineData.todayRecords.filter(record => record.hasPhoto && record.photoPath)
    const urls = photosRecords.map(record => record.photoPath)

    wx.previewImage({
      urls: urls,
      current: urls[index]
    })
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
