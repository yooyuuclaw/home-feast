# 健康管理功能部署说明

## 功能概述
已为小程序添加了健康管理模块，用户可以记录和查看个人健康指标，包括：
- 体重
- 身高
- 血压（收缩压/舒张压）
- 血氧饱和度
- 血糖（含测量时机）
- 尿酸

## 权限控制
- ✅ 仅非未受邀访客用户可访问
- ✅ **uninvited_guest（未受邀访客）** 无权限进入健康管理
- ✅ **invited_guest（受邀访客）**、**regular（常客）**、**chef（主厨）**、**admin（管理员）** 都可以访问
- ✅ 每个用户只能查看和管理自己的健康数据

## 已完成的文件

### 前端页面
1. **首页修改**
   - `miniprogram/pages/index/index.wxml` - 添加健康管理入口卡片
   - `miniprogram/pages/index/index.js` - 添加权限判断和跳转逻辑
   - `miniprogram/pages/index/index.wxss` - 添加健康卡片样式

2. **健康管理主页**
   - `miniprogram/pages/health/health.json`
   - `miniprogram/pages/health/health.wxml`
   - `miniprogram/pages/health/health.js`
   - `miniprogram/pages/health/health.wxss`

3. **健康数据录入页**
   - `miniprogram/pages/health/health-add/health-add.json`
   - `miniprogram/pages/health/health-add/health-add.wxml`
   - `miniprogram/pages/health/health-add/health-add.js`
   - `miniprogram/pages/health/health-add/health-add.wxss`

### 云函数
4. **健康数据云函数**
   - `cloudfunctions/health/index.js`
   - `cloudfunctions/health/package.json`

### 配置文件
5. **路由注册**
   - `miniprogram/app.json` - 已添加健康管理页面路由

## 部署步骤

### 1. 上传并部署云函数
```bash
# 在微信开发者工具中：
# 右键 cloudfunctions/health 文件夹
# 选择"上传并部署：云端安装依赖"
```

### 2. 创建数据库集合
在云开发控制台创建集合：`health_records`

**字段说明：**
- `_id`: 记录ID（自动生成）
- `_openid`: 用户openid（自动关联）
- `type`: 健康指标类型（weight/height/bloodPressure等）
- `value`: 数值（字符串）
- `displayValue`: 显示值（带单位）
- `recordDate`: 记录日期时间
- `note`: 备注
- `extra`: 额外信息（如血糖测量时机）
- `createTime`: 创建时间
- `updateTime`: 更新时间

**索引建议：**
- `_openid` + `type` + `recordDate`（组合索引，提升查询效率）

### 3. 设置数据库权限
- 集合权限：仅创建者可读写
- 这样确保用户只能访问自己的健康数据

## 功能特性

### 主页面功能
- ✅ 健康概览卡片（显示最新的各项指标）
- ✅ 快捷添加记录按钮
- ✅ 分类指标卡片（显示各类型记录数量）
- ✅ 最近记录列表（支持筛选）
- ✅ 长按删除记录
- ✅ 下拉刷新

### 录入页面功能
- ✅ 可视化指标选择器
- ✅ 日期时间选择
- ✅ 输入验证（范围检查、逻辑验证）
- ✅ 血压双值输入（收缩压/舒张压）
- ✅ 血糖测量时机选择
- ✅ 备注功能
- ✅ 友好的参考范围提示

### 云函数功能
- ✅ 添加记录（add）
- ✅ 获取记录列表（list）
- ✅ 删除记录（delete）
- ✅ 统计数据（statistics）- 预留接口
- ✅ 权限验证

## 界面设计特点

参考小米健康APP设计风格：
- 🎨 粉红色系主题（#FFE5E5, #FF6B6B）
- 🎨 卡片式布局
- 🎨 大图标设计
- 🎨 渐变背景
- 🎨 圆角设计
- 🎨 流畅动画效果

## 待扩展功能（可选）

由于第6个任务"实现数据可视化图表展示"标记为pending，以下是可选的增强方向：

### 数据可视化
- 📊 使用 echarts-for-weixin 绘制趋势图
- 📊 体重/血压变化曲线
- 📊 健康指标对比图
- 📊 周报/月报统计

### AI 增强（如连接 Nano Banana 2 API）
- 🤖 健康数据分析和建议
- 🤖 异常指标预警
- 🤖 个性化健康方案
- 🤖 智能趋势预测

## 注意事项

1. **隐私保护**：健康数据非常敏感，已确保：
   - 每个用户只能访问自己的数据
   - 未受邀访客（uninvited_guest）无权访问健康模块
   - 数据库权限设置为仅创建者可读写

2. **数据备份**：建议定期备份健康数据

3. **单位统一**：所有数值都使用标准医学单位

4. **参考范围**：页面中的参考范围仅供参考，具体请咨询医生

## 测试建议

1. 测试不同角色的权限控制
2. 测试各类型健康指标的添加
3. 测试数据验证逻辑
4. 测试筛选和删除功能
5. 测试长时间数据累积后的性能

## 技术栈

- 微信小程序原生框架
- 云开发数据库
- 云函数
- CSS3 动画
- 渐变色设计

---

部署完成后，用户可以从首页的"健康小本本"卡片进入健康管理功能！
