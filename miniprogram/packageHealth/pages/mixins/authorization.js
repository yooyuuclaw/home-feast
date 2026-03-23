/**
 * 授权管理功能模块
 */

export default {
  data: {
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
    viewOptions: []  // 可查看的用户列表（包括自己）
  },

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

      const myAuthorizations = (myAuthRes.result && myAuthRes.result.data) || []
      const authorizedToMe = (authorizedRes.result && authorizedRes.result.data) || []

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
}
