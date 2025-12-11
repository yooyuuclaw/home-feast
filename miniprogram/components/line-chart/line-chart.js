// 折线图组件
Component({
  properties: {
    // 图表标题
    title: {
      type: String,
      value: '趋势图'
    },
    // 图表数据 [{date: '2024-01-01', value: 65.5}, ...]
    chartData: {
      type: Array,
      value: [],
      observer: 'drawChart'
    },
    // 图表ID（用于多个图表实例）
    chartId: {
      type: String,
      value: 'default'
    },
    // 单位
    unit: {
      type: String,
      value: ''
    },
    // 颜色主题
    color: {
      type: String,
      value: '#667eea'
    }
  },

  data: {
    timeRange: '7', // 默认显示近7天
    showTooltip: false,
    tooltipX: 0,
    tooltipY: 0,
    tooltipData: {},
    canvasWidth: 0,
    canvasHeight: 0,
    dataPoints: [] // 存储数据点坐标
  },

  lifetimes: {
    attached() {
      this.getCanvasSize()
    }
  },

  methods: {
    /**
     * 获取画布尺寸
     */
    getCanvasSize() {
      const query = this.createSelectorQuery()
      query.select('.chart-canvas').boundingClientRect(rect => {
        if (rect) {
          this.setData({
            canvasWidth: rect.width,
            canvasHeight: rect.height
          })
          this.drawChart()
        }
      }).exec()
    },

    /**
     * 切换时间范围
     */
    changeTimeRange(e) {
      const range = e.currentTarget.dataset.range
      this.setData({ timeRange: range })
      this.triggerEvent('rangechange', { range })
    },

    /**
     * 绘制图表
     */
    drawChart() {
      if (!this.data.chartData || this.data.chartData.length === 0) return
      if (!this.data.canvasWidth || !this.data.canvasHeight) return

      const ctx = wx.createCanvasContext(`lineChart${this.data.chartId}`, this)
      const { canvasWidth, canvasHeight, chartData, color, unit } = this.data

      // 设置绘图区域边距
      const padding = { top: 20, right: 20, bottom: 40, left: 50 }
      const chartWidth = canvasWidth - padding.left - padding.right
      const chartHeight = canvasHeight - padding.top - padding.bottom

      // 计算数据范围
      const values = chartData.map(d => d.value)
      const maxValue = Math.max(...values)
      const minValue = Math.min(...values)
      const valueRange = maxValue - minValue || 1

      // 添加一些上下边距
      const displayMax = maxValue + valueRange * 0.1
      const displayMin = minValue - valueRange * 0.1

      // 清空画布
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // 绘制网格线和Y轴刻度
      ctx.setStrokeStyle('#E0E0E0')
      ctx.setLineWidth(1)
      ctx.setFontSize(10)
      ctx.setFillStyle('#999')

      const ySteps = 5
      for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + (chartHeight / ySteps) * i
        const value = displayMax - (displayMax - displayMin) * (i / ySteps)

        // 绘制网格线
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(padding.left + chartWidth, y)
        ctx.stroke()

        // 绘制Y轴标签
        ctx.fillText(value.toFixed(1), 5, y + 3)
      }

      // 计算数据点坐标
      const dataPoints = []
      const xStep = chartWidth / (chartData.length - 1 || 1)

      chartData.forEach((item, index) => {
        const x = padding.left + xStep * index
        const y = padding.top + chartHeight - ((item.value - displayMin) / (displayMax - displayMin)) * chartHeight
        dataPoints.push({ x, y, date: item.date, value: item.value })
      })

      this.setData({ dataPoints })

      // 绘制渐变填充区域
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight)
      gradient.addColorStop(0, `${color}40`)
      gradient.addColorStop(1, `${color}00`)

      ctx.beginPath()
      ctx.moveTo(dataPoints[0].x, canvasHeight - padding.bottom)
      dataPoints.forEach(point => {
        ctx.lineTo(point.x, point.y)
      })
      ctx.lineTo(dataPoints[dataPoints.length - 1].x, canvasHeight - padding.bottom)
      ctx.closePath()
      ctx.setFillStyle(gradient)
      ctx.fill()

      // 绘制折线
      ctx.beginPath()
      ctx.moveTo(dataPoints[0].x, dataPoints[0].y)
      dataPoints.forEach(point => {
        ctx.lineTo(point.x, point.y)
      })
      ctx.setStrokeStyle(color)
      ctx.setLineWidth(2)
      ctx.stroke()

      // 绘制数据点
      dataPoints.forEach(point => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI)
        ctx.setFillStyle('white')
        ctx.fill()
        ctx.setStrokeStyle(color)
        ctx.setLineWidth(2)
        ctx.stroke()
      })

      // 绘制X轴日期标签（简化显示）
      ctx.setFillStyle('#666')
      ctx.setFontSize(10)
      const labelStep = Math.ceil(chartData.length / 5) // 最多显示5个标签
      chartData.forEach((item, index) => {
        if (index % labelStep === 0 || index === chartData.length - 1) {
          const point = dataPoints[index]
          const dateStr = item.date.slice(5) // 显示月-日
          ctx.fillText(dateStr, point.x - 15, canvasHeight - padding.bottom + 20)
        }
      })

      ctx.draw()
    },

    /**
     * 触摸开始
     */
    touchStart(e) {
      this.handleTouch(e)
    },

    /**
     * 触摸移动
     */
    touchMove(e) {
      this.handleTouch(e)
    },

    /**
     * 处理触摸事件
     */
    handleTouch(e) {
      const touch = e.touches[0]
      const { dataPoints, unit } = this.data

      // 查找最近的数据点
      let minDistance = Infinity
      let nearestPoint = null

      dataPoints.forEach(point => {
        const distance = Math.abs(touch.x - point.x)
        if (distance < minDistance && distance < 30) {
          minDistance = distance
          nearestPoint = point
        }
      })

      if (nearestPoint) {
        this.setData({
          showTooltip: true,
          tooltipX: nearestPoint.x - 40,
          tooltipY: nearestPoint.y - 60,
          tooltipData: {
            date: nearestPoint.date,
            value: `${nearestPoint.value}${unit}`
          }
        })
      }
    },

    /**
     * 触摸结束
     */
    touchEnd() {
      this.setData({ showTooltip: false })
    }
  }
})
