import * as echarts from './echarts.min'

let ctx

function compareVersion(v1, v2) {
  v1 = v1.split('.')
  v2 = v2.split('.')
  const len = Math.max(v1.length, v2.length)

  while (v1.length < len) {
    v1.push('0')
  }
  while (v2.length < len) {
    v2.push('0')
  }

  for (let i = 0; i < len; i++) {
    const num1 = parseInt(v1[i])
    const num2 = parseInt(v2[i])

    if (num1 > num2) {
      return 1
    } else if (num1 < num2) {
      return -1
    }
  }
  return 0
}

Component({
  properties: {
    canvasId: {
      type: String,
      value: 'ec-canvas'
    },

    ec: {
      type: Object
    },

    forceUseOldCanvas: {
      type: Boolean,
      value: false
    },

    disableScroll: {
      type: Boolean,
      value: false
    }
  },

  data: {
    isUseNewCanvas: false
  },

  ready: function () {
    // Disable prograssive because drawImage doesn't support DOM as parameter
    // See https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.drawImage.html

    // 不要在这里设置 setPlatformAPI，因为它需要同步返回 canvas
    // ECharts 会在初始化时自己创建需要的 canvas

    if (!this.data.ec) {
      console.warn('组件需绑定 ec 变量，例：<ec-canvas id="mychart-dom-bar" canvas-id="mychart-bar" ec="{{ ec }}"></ec-canvas>')
      return
    }

    if (!this.data.ec.lazyLoad) {
      this.init()
    }
  },

  methods: {
    init: function (callback) {
      const version = wx.getSystemInfoSync().SDKVersion

      const canUseNewCanvas = compareVersion(version, '2.9.0') >= 0
      const forceUseOldCanvas = this.data.forceUseOldCanvas
      const isUseNewCanvas = canUseNewCanvas && !forceUseOldCanvas
      this.setData({ isUseNewCanvas })

      if (forceUseOldCanvas && canUseNewCanvas) {
        console.warn('开发者强制使用旧canvas,建议关闭')
      }

      if (isUseNewCanvas) {
        // 新版本使用 type="2d" 的 canvas
        this.initByNewWay(callback)
      } else {
        // 旧版本使用 canvas-id
        const isValid = compareVersion(version, '1.9.91') >= 0
        if (!isValid) {
          console.error('微信基础库版本过低，需要使用 1.9.91 及以上的版本。')
          return
        }
        this.initByOldWay(callback)
      }
    },

    initByOldWay(callback) {
      // 旧的初始化方法（使用 canvas-id）
      ctx = wx.createCanvasContext(this.data.canvasId, this)
      const canvas = new WxCanvas(ctx, this.data.canvasId, false)

      if (typeof callback === 'function') {
        this.chart = callback(canvas, echarts)
      } else if (this.data.ec && typeof this.data.ec.onInit === 'function') {
        this.chart = this.data.ec.onInit(canvas, echarts)
      } else {
        this.triggerEvent('init', {
          canvas: canvas,
          echarts: echarts
        })
      }
    },

    initByNewWay(callback) {
      // 新的初始化方法（使用 type="2d"）
      const query = wx.createSelectorQuery().in(this)
      query
        .select(`#${this.data.canvasId}`)
        .fields({ node: true, size: true })
        .exec(res => {
          if (res && res[0]) {
            const { node, width, height } = res[0]
            const canvasDpr = wx.getSystemInfoSync().pixelRatio
            const canvas = new WxCanvas(node, this.data.canvasId, true, canvasDpr, width, height)

            if (typeof callback === 'function') {
              this.chart = callback(canvas, echarts)
            } else if (this.data.ec && typeof this.data.ec.onInit === 'function') {
              this.chart = this.data.ec.onInit(canvas, echarts)
            } else {
              this.triggerEvent('init', {
                canvas: canvas,
                echarts: echarts
              })
            }
          }
        })
    },

    initCanvas() {
      console.log('[ec-canvas] initCanvas 被调用 - ECharts 请求创建新 canvas')
      const query = wx.createSelectorQuery().in(this)
      return new Promise((resolve, reject) => {
        query
          .select(`#${this.data.canvasId}`)
          .fields({ node: true, size: true })
          .exec(res => {
            console.log('[ec-canvas] initCanvas exec 回调, res:', res)
            if (res && res[0]) {
              const { node, width, height } = res[0]
              const canvasDpr = wx.getSystemInfoSync().pixelRatio
              console.log('[ec-canvas] initCanvas 创建新的 WxCanvas, node:', node, 'width:', width, 'height:', height)

              const canvas = new WxCanvas(node, this.data.canvasId, true, canvasDpr, width, height)

              console.log('[ec-canvas] initCanvas WxCanvas 创建完成')
              console.log('[ec-canvas] canvas.getContext:', typeof canvas.getContext)
              console.log('[ec-canvas] canvas.width:', canvas.width)
              console.log('[ec-canvas] canvas.height:', canvas.height)

              // 验证 getContext 方法
              const testCtx = canvas.getContext('2d')
              console.log('[ec-canvas] 测试 getContext 返回:', testCtx)

              resolve(canvas)
            } else {
              console.error('[ec-canvas] initCanvas 无法获取 canvas node, res:', res)
              reject(new Error('无法获取 canvas node'))
            }
          })
      })
    },

    canvasToTempFilePath(opt) {
      if (this.data.isUseNewCanvas) {
        const query = wx.createSelectorQuery().in(this)
        query
          .select(`#${this.data.canvasId}`)
          .fields({ node: true, size: true })
          .exec(res => {
            const canvasNode = res[0].node
            opt.canvas = canvasNode
            wx.canvasToTempFilePath(opt)
          })
      } else {
        if (!opt.canvasId) {
          opt.canvasId = this.data.canvasId
        }
        ctx.draw(true, () => {
          wx.canvasToTempFilePath(opt, this)
        })
      }
    }
  }
})

class WxCanvas {
  constructor(ctx, canvasId, isNew, canvasDpr, width, height) {
    console.log('[WxCanvas] 构造函数参数:')
    console.log('[WxCanvas] ctx:', ctx)
    console.log('[WxCanvas] isNew:', isNew)

    this.canvasId = canvasId
    this.chart = null
    this.isNew = isNew

    if (isNew) {
      // 新版 canvas 2d: ctx 是 canvas node
      this.node = ctx
      this.ctx = ctx.getContext('2d')
      this.canvasDpr = canvasDpr
      this._width = width
      this._height = height

      console.log('[WxCanvas] 使用新版 canvas 2d')
      console.log('[WxCanvas] ctx (2d context):', this.ctx)

      if (this.ctx) {
        this.node.width = width * canvasDpr
        this.node.height = height * canvasDpr
        this.ctx.scale(canvasDpr, canvasDpr)
        console.log('[WxCanvas] scale 调用成功')
      } else {
        console.error('[ec-canvas] 无法获取 2d 渲染上下文')
      }
    } else {
      // 旧版 canvas: ctx 就是渲染上下文
      console.log('[WxCanvas] 使用旧版 canvas')
      this.ctx = ctx
      this._width = 0
      this._height = 0
    }
  }

  getContext(contextType) {
    console.log('[WxCanvas] getContext 被调用, contextType:', contextType)
    if (contextType === '2d') {
      return this.ctx
    }
  }

  // 添加 toDataURL 方法，某些版本的 ECharts 可能需要
  toDataURL() {
    if (this.isNew && this.node) {
      return this.node.toDataURL()
    }
    return ''
  }

  get width() {
    return this._width
  }

  set width(w) {
    this._width = w
  }

  get height() {
    return this._height
  }

  set height(h) {
    this._height = h
  }

  addEventListener() {}

  attachEvent() {}

  detachEvent() {}

  removeEventListener() {}
}

export { echarts }
