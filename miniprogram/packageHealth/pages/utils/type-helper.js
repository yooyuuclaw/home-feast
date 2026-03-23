/**
 * 健康数据类型辅助工具函数
 */

/**
 * 获取类型图标
 * @param {string} type - 数据类型
 * @returns {string} emoji图标
 */
export function getTypeIcon(type) {
  const iconMap = {
    weight: '⚖️',
    bloodPressure: '❤️',
    bloodOxygen: '💨',
    bloodSugar: '🩸',
    uricAcid: '💧',
    height: '📏'
  }
  return iconMap[type] || '📊'
}

/**
 * 获取类型名称
 * @param {string} type - 数据类型
 * @returns {string} 中文名称
 */
export function getTypeName(type) {
  const nameMap = {
    weight: '体重',
    bloodPressure: '血压',
    bloodOxygen: '血氧',
    bloodSugar: '血糖',
    uricAcid: '尿酸',
    height: '身高'
  }
  return nameMap[type] || type
}

/**
 * 获取查看模式的随机提示消息
 * @returns {string} 提示消息
 */
export function getViewModeMessage() {
  const messages = [
    '哎呀！您正在"云监工"模式呢 👀\n只能看不能动手哦~',
    '您现在是"吃瓜群众"身份 🍉\n围观可以，参与不行~',
    '温馨提示：您在看别人的数据呢 👓\n想操作的话，先切回自己吧！',
    '您现在是"隐形观察员" 🕵️\n这不是您的数据，不能随意改动哦~',
    '停停停！您在"参观模式" 🚶\n要添加记录请先回到自己的账号~'
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}
