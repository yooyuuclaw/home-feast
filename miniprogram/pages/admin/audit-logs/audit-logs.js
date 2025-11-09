// pages/admin/audit-logs/audit-logs.js
const ACTION_NAMES = {
  user_role_update: '用户角色修改',
  dish_create: '创建菜品',
  dish_update: '更新菜品',
  dish_delete: '删除菜品',
  gathering_create: '创建聚餐日',
  gathering_update: '更新聚餐日',
  gathering_delete: '删除聚餐日',
  order_delete: '删除订单',
  backup_create: '创建备份',
  permission_denied: '权限被拒绝',
  unauthorized_access: '未授权访问'
}

const LEVEL_NAMES = {
  info: '信息',
  warning: '警告',
  critical: '关键'
}

Page({
  data: {
    logs: [],
    stats: null,
    loading: false,
    currentFilter: 'all', // all, critical, warning
    filterOptions: ['全部', '关键操作', '警告'],
    currentFilterIndex: 0
  },

  onLoad() {
    this.loadLogs()
    this.loadStats()
  },

  async loadLogs() {
    try {
      this.setData({ loading: true })

      const filter = {}
      if (this.data.currentFilter === 'critical') {
        filter.level = 'critical'
      } else if (this.data.currentFilter === 'warning') {
        filter.level = 'warning'
      }

      const res = await wx.cloud.callFunction({
        name: 'audit',
        data: {
          action: 'getLogs',
          limit: 50,
          ...filter
        }
      })

      if (res.result.success) {
        const logs = res.result.data.map(log => {
          // 创建一个纯净的对象，只包含需要的字段
          return {
            _id: log._id || '',
            action: log.action || '',
            actionName: ACTION_NAMES[log.action] || log.action || '',
            level: log.level || '',
            levelName: LEVEL_NAMES[log.level] || log.level || '',
            levelClass: this.getLevelClass(log.level),
            userId: log.userId || '',
            userRole: log.userRole || '',
            targetType: log.targetType || '',
            targetId: log.targetId || '',
            message: log.message || '',
            success: log.success === true,
            successIcon: log.success ? '✓' : '✗',
            timestamp: log.timestamp || '',
            timeStr: this.formatTime(log.timestamp),
            details: log.details || {}
          }
        })

        this.setData({
          logs: logs,
          loading: false
        })
      }
    } catch (err) {
      console.error('加载审计日志失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'audit',
        data: {
          action: 'getStats',
          days: 7
        }
      })

      if (res.result.success) {
        this.setData({
          stats: res.result.data
        })
      }
    } catch (err) {
      console.error('加载统计失败', err)
    }
  },

  selectFilter() {
    wx.showActionSheet({
      itemList: this.data.filterOptions,
      success: (res) => {
        const filterMap = ['all', 'critical', 'warning']
        this.setData({
          currentFilter: filterMap[res.tapIndex],
          currentFilterIndex: res.tapIndex
        })
        this.loadLogs()
      }
    })
  },

  viewDetail(e) {
    const log = e.currentTarget.dataset.log

    // 格式化详细信息 - 显示所有字段
    let detailText = `操作: ${log.actionName || log.action}\n`
    detailText += `时间: ${log.timeStr}\n`
    detailText += `操作用户ID: ${log.userId || '(未记录)'}\n`
    detailText += `用户角色: ${log.userRole || '(未记录)'}\n`
    detailText += `目标类型: ${log.targetType || '(未记录)'}\n`
    detailText += `目标ID: ${log.targetId || '(未记录)'}\n`
    detailText += `操作级别: ${log.levelName || log.level}\n`
    detailText += `状态: ${log.success ? '✅ 成功' : '❌ 失败'}\n`
    detailText += `说明: ${log.message || '(无)'}\n`

    if (log.details && Object.keys(log.details).length > 0) {
      detailText += `\n详细信息:\n${JSON.stringify(log.details, null, 2)}`
    }

    wx.showModal({
      title: '审计日志详情',
      content: detailText,
      showCancel: false,
      confirmText: '关闭'
    })
  },

  formatTime(timestamp) {
    if (!timestamp) return ''

    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    // 少于1分钟
    if (diff < 60000) {
      return '刚刚'
    }

    // 少于1小时
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`
    }

    // 少于24小时
    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`
    }

    // 超过24小时，显示具体日期
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  getLevelClass(level) {
    const classMap = {
      critical: 'level-critical',
      warning: 'level-warning',
      info: 'level-info'
    }
    return classMap[level] || 'level-info'
  },

  onRefresh() {
    this.loadLogs()
    this.loadStats()
  }
})
