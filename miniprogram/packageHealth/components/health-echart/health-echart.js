// 健康数据 ECharts 图表组件
import * as echarts from '../ec-canvas/echarts.min'
import { calculateHealthStats } from '../../pages/utils/chart-helper'

let chart = null

Component({
  properties: {
    // 图表标题
    title: {
      type: String,
      value: '健康趋势'
    },
    // 图表数据 [{date: '2024-01-01', value: 65.5}, ...]
    chartData: {
      type: Array,
      value: [],
      observer: 'updateChart'
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
    },
    // 图表类型（用于特殊处理）
    chartType: {
      type: String,
      value: 'line'
    }
  },

  data: {
    ec: {
      onInit: null
    },
    timeRange: '7',
    stats: {
      max: 0,
      min: 0,
      avg: 0,
      trend: 'stable'
    }
  },

  lifetimes: {
    attached() {
      this.initChart()
    }
  },

  methods: {
    /**
     * 初始化图表
     */
    initChart() {
      this.setData({
        ec: {
          onInit: this.initChartInstance.bind(this)
        }
      })
    },

    /**
     * 初始化图表实例
     */
    initChartInstance(canvas, echartsLib) {
      console.log('[health-echart] 初始化图表实例')
      console.log('[health-echart] canvas:', canvas)
      console.log('[health-echart] canvas 类型:', typeof canvas)
      console.log('[health-echart] canvas.constructor.name:', canvas?.constructor?.name)
      console.log('[health-echart] canvas.getContext:', typeof canvas?.getContext)
      console.log('[health-echart] canvas.width:', canvas?.width)
      console.log('[health-echart] canvas.height:', canvas?.height)
      console.log('[health-echart] echartsLib:', echartsLib)

      // 确保 canvas 对象有 getContext 方法
      if (!canvas || typeof canvas.getContext !== 'function') {
        console.error('[health-echart] canvas 对象无效或没有 getContext 方法')
        console.error('[health-echart] canvas 对象的所有属性:', Object.keys(canvas || {}))
        return null
      }

      console.log('[health-echart] 开始初始化 ECharts')

      chart = echarts.init(canvas, null, {
        width: canvas.width,
        height: canvas.height,
        devicePixelRatio: wx.getWindowInfo().pixelRatio
      })

      console.log('[health-echart] 图表实例已创建:', chart)

      // 如果已有数据，立即渲染
      if (this.data.chartData && this.data.chartData.length > 0) {
        console.log('[health-echart] 立即渲染图表, 数据长度:', this.data.chartData.length)
        this.renderChart()
      }

      return chart
    },

    /**
     * 更新图表
     */
    updateChart() {
      if (this.data.chartData && this.data.chartData.length > 0) {
        // 计算统计数据
        const stats = calculateHealthStats(this.data.chartData)
        this.setData({ stats })

        // 如果图表已初始化，则更新
        if (chart) {
          this.renderChart()
        }
      }
    },

    /**
     * 渲染图表
     */
    renderChart() {
      if (!chart || !this.data.chartData || this.data.chartData.length === 0) {
        console.log('[health-echart] 无法渲染图表: chart=', !!chart, 'chartData=', this.data.chartData)
        return
      }

      const { chartData, color, unit } = this.data

      console.log('[health-echart] 开始渲染图表, 数据:', chartData)

      // 提取日期和数值
      const dates = chartData.map(item => {
        // 格式化日期显示，修复 iOS 兼容性问题
        const date = new Date(item.date.replace(/-/g, '/'))
        return `${date.getMonth() + 1}/${date.getDate()}`
      })
      const values = chartData.map(item => item.value)

      console.log('[health-echart] dates:', dates)
      console.log('[health-echart] values:', values)

      // 配置图表选项
      const option = {
        backgroundColor: 'transparent',
        grid: {
          top: 40,
          right: 20,
          bottom: 60,
          left: 50,
          containLabel: false
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: 'transparent',
          textStyle: {
            color: '#fff',
            fontSize: 12
          },
          formatter: (params) => {
            const data = params[0]
            return `${data.name}<br/>${data.value}${unit}`
          }
        },
        xAxis: {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: {
            lineStyle: {
              color: '#E0E0E0'
            }
          },
          axisLabel: {
            color: '#999',
            fontSize: 10,
            interval: Math.floor(dates.length / 5) || 0
          },
          axisTick: {
            show: false
          }
        },
        yAxis: {
          type: 'value',
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            color: '#999',
            fontSize: 10
          },
          splitLine: {
            lineStyle: {
              color: '#F0F0F0',
              type: 'dashed'
            }
          }
        },
        series: [
          {
            name: this.data.title,
            type: 'line',
            data: values,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            showSymbol: true,
            lineStyle: {
              width: 3,
              color: color
            },
            itemStyle: {
              color: color,
              borderColor: '#fff',
              borderWidth: 2
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  {
                    offset: 0,
                    color: `${color}40` // 透明度 40%
                  },
                  {
                    offset: 1,
                    color: `${color}05` // 透明度 5%
                  }
                ]
              }
            },
            emphasis: {
              focus: 'series',
              itemStyle: {
                shadowBlur: 10,
                shadowColor: color,
                borderWidth: 3
              }
            }
          }
        ]
      }

      console.log('[health-echart] 设置图表选项')
      chart.setOption(option)
      console.log('[health-echart] 图表渲染完成')
    },

    /**
     * 切换时间范围
     */
    changeTimeRange(e) {
      const range = e.currentTarget.dataset.range
      this.setData({ timeRange: range })
      this.triggerEvent('rangechange', { range })
    }
  }
})
