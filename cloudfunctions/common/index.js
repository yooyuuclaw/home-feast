// cloudfunctions/common/index.js
/**
 * Common 云函数 - 公共模块入口
 *
 * 注意：此云函数主要用于导出公共模块（constants.js 和 errorHandler.js）
 * 供其他云函数通过 require('../common/constants.js') 方式引用
 *
 * 如果需要作为独立云函数调用，可以在这里添加处理逻辑
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloudbase-1gdysknn57ce9b9f'
})

exports.main = async (event, context) => {
  // 此云函数主要用于模块导出，不直接调用
  // 如果被直接调用，返回版本信息
  return {
    success: true,
    message: 'Common 公共模块已部署',
    version: '1.0.0',
    modules: ['constants.js', 'errorHandler.js']
  }
}
