# ECharts for WeChat Mini Program 安装说明

## 📦 需要下载的文件

由于 echarts.min.js 文件较大（约800KB），需要手动下载：

### 方法一：从官方 CDN 下载（推荐）

1. 访问：https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js
2. 右键 -> 另存为，保存到当前目录
3. 文件名：`echarts.min.js`

### 方法二：从 GitHub 下载

1. 访问：https://github.com/ecomfe/echarts-for-weixin
2. 下载 ec-canvas/echarts.js 文件
3. 重命名为 `echarts.min.js` 并放到当前目录

### 方法三：使用 npm 安装（如果项目支持）

```bash
npm install echarts --save
```

然后从 node_modules/echarts/dist/echarts.min.js 复制到当前目录

## 📁 最终文件结构

```
components/ec-canvas/
├── ec-canvas.js         ✅ 已创建
├── ec-canvas.json       ✅ 已创建
├── ec-canvas.wxml       ✅ 已创建
├── ec-canvas.wxss       ✅ 已创建
├── echarts.min.js       ⚠️  需要下载
└── README.md            ✅ 当前文件
```

## 🚀 使用方法

下载完 echarts.min.js 后，就可以在页面中使用：

```json
// page.json
{
  "usingComponents": {
    "ec-canvas": "/components/ec-canvas/ec-canvas"
  }
}
```

```html
<!-- page.wxml -->
<view class="container">
  <ec-canvas id="mychart" canvas-id="mychart" ec="{{ ec }}"></ec-canvas>
</view>
```

```javascript
// page.js
import * as echarts from '../../components/ec-canvas/echarts.min'

Page({
  data: {
    ec: {
      onInit: initChart
    }
  }
})

function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  })

  const option = {
    // 你的图表配置
  }

  chart.setOption(option)
  return chart
}
```

## ⚡ 按需引入（减小体积）

如果只需要折线图，可以使用自定义构建：

访问 https://echarts.apache.org/zh/builder.html
只选择需要的图表类型，下载自定义版本

## 📝 注意事项

1. echarts.min.js 文件大小约 800KB，会影响小程序包大小
2. 建议放在分包中使用
3. 或使用 echarts 按需引入版本减小体积
