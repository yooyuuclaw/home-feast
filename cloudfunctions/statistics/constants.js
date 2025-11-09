// cloudfunctions/common/constants.js
/**
 * 统一的常量配置
 * 用于角色、分类、状态等枚举值的集中管理
 */

/**
 * 用户角色定义
 */
const USER_ROLES = {
  UNINVITED_GUEST: 'uninvited_guest',
  INVITED_GUEST: 'invited_guest',
  REGULAR: 'regular',
  CHEF: 'chef',
  ADMIN: 'admin'
}

/**
 * 角色权限等级（数字越大权限越高）
 */
const ROLE_LEVELS = {
  [USER_ROLES.UNINVITED_GUEST]: 0,
  [USER_ROLES.INVITED_GUEST]: 1,
  [USER_ROLES.REGULAR]: 2,
  [USER_ROLES.CHEF]: 3,
  [USER_ROLES.ADMIN]: 4
}

/**
 * 角色显示名称
 */
const ROLE_NAMES = {
  [USER_ROLES.UNINVITED_GUEST]: '未受邀访客',
  [USER_ROLES.INVITED_GUEST]: '受邀访客',
  [USER_ROLES.REGULAR]: '常客',
  [USER_ROLES.CHEF]: '厨师',
  [USER_ROLES.ADMIN]: '管理员'
}

/**
 * 所有有效角色列表
 */
const VALID_ROLES = Object.values(USER_ROLES)

/**
 * 菜品分类定义
 */
const DISH_CATEGORIES = {
  COLD_DISH: 'cold_dish',
  MAIN_DISH: 'main_dish',
  STIR_FRY: 'stir_fry',
  SOUP: 'soup',
  STAPLE: 'staple',
  DESSERT: 'dessert',
  BREAKFAST: 'breakfast'
}

/**
 * 分类显示名称
 */
const CATEGORY_NAMES = {
  [DISH_CATEGORIES.COLD_DISH]: '凉菜',
  [DISH_CATEGORIES.MAIN_DISH]: '主菜',
  [DISH_CATEGORIES.STIR_FRY]: '小炒',
  [DISH_CATEGORIES.SOUP]: '汤',
  [DISH_CATEGORIES.STAPLE]: '主食',
  [DISH_CATEGORIES.DESSERT]: '甜品',
  [DISH_CATEGORIES.BREAKFAST]: '早餐'
}

/**
 * 所有有效分类列表
 */
const VALID_CATEGORIES = Object.values(DISH_CATEGORIES)

/**
 * 订单状态定义
 */
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed'
}

/**
 * 状态显示名称
 */
const ORDER_STATUS_NAMES = {
  [ORDER_STATUS.PENDING]: '待确认',
  [ORDER_STATUS.CONFIRMED]: '已确认',
  [ORDER_STATUS.COMPLETED]: '已完成'
}

/**
 * 所有有效订单状态列表
 */
const VALID_ORDER_STATUS = Object.values(ORDER_STATUS)

/**
 * 菜品状态定义
 */
const DISH_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline'
}

/**
 * 所有有效菜品状态列表
 */
const VALID_DISH_STATUS = Object.values(DISH_STATUS)

/**
 * 权限检查辅助函数
 */

/**
 * 检查用户是否拥有最低要求角色
 * @param {string} userRole - 用户当前角色
 * @param {string} requiredRole - 要求的最低角色
 * @returns {boolean}
 */
function hasMinimumRole(userRole, requiredRole) {
  const userLevel = ROLE_LEVELS[userRole] || 0
  const requiredLevel = ROLE_LEVELS[requiredRole] || 0
  return userLevel >= requiredLevel
}

/**
 * 验证角色是否有效
 * @param {string} role - 要验证的角色
 * @returns {boolean}
 */
function isValidRole(role) {
  return VALID_ROLES.includes(role)
}

/**
 * 验证分类是否有效
 * @param {string} category - 要验证的分类
 * @returns {boolean}
 */
function isValidCategory(category) {
  return VALID_CATEGORIES.includes(category)
}

/**
 * 验证订单状态是否有效
 * @param {string} status - 要验证的状态
 * @returns {boolean}
 */
function isValidOrderStatus(status) {
  return VALID_ORDER_STATUS.includes(status)
}

/**
 * 验证菜品状态是否有效
 * @param {string} status - 要验证的状态
 * @returns {boolean}
 */
function isValidDishStatus(status) {
  return VALID_DISH_STATUS.includes(status)
}

/**
 * 获取角色显示名称
 * @param {string} role - 角色值
 * @returns {string}
 */
function getRoleName(role) {
  return ROLE_NAMES[role] || role
}

/**
 * 获取分类显示名称
 * @param {string} category - 分类值
 * @returns {string}
 */
function getCategoryName(category) {
  return CATEGORY_NAMES[category] || category
}

/**
 * 获取订单状态显示名称
 * @param {string} status - 状态值
 * @returns {string}
 */
function getOrderStatusName(status) {
  return ORDER_STATUS_NAMES[status] || status
}

module.exports = {
  // 用户角色相关
  USER_ROLES,
  ROLE_LEVELS,
  ROLE_NAMES,
  VALID_ROLES,
  hasMinimumRole,
  isValidRole,
  getRoleName,

  // 菜品分类相关
  DISH_CATEGORIES,
  CATEGORY_NAMES,
  VALID_CATEGORIES,
  isValidCategory,
  getCategoryName,

  // 订单状态相关
  ORDER_STATUS,
  ORDER_STATUS_NAMES,
  VALID_ORDER_STATUS,
  isValidOrderStatus,
  getOrderStatusName,

  // 菜品状态相关
  DISH_STATUS,
  VALID_DISH_STATUS,
  isValidDishStatus
}
