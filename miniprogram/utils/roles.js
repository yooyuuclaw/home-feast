/**
 * 用户角色配置
 */

// 角色类型枚举
const ROLES = {
  UNINVITED_GUEST: 'uninvited_guest',  // 未受邀访客
  INVITED_GUEST: 'invited_guest',       // 受邀访客
  REGULAR: 'regular',                   // 常客
  CHEF: 'chef',                         // 主厨
  ADMIN: 'admin'                        // 管理员
}

// 角色显示名称
const ROLE_NAMES = {
  'uninvited_guest': '未受邀访客',
  'invited_guest': '受邀访客',
  'regular': '常客',
  'chef': '主厨',
  'admin': '管理员',
  // 兼容旧角色
  'guest': '访客（旧）'
}

// 角色描述
const ROLE_DESCRIPTIONS = {
  'uninvited_guest': '新用户，暂未受邀参加聚餐',
  'invited_guest': '已受邀参加特定聚餐日的访客，只能在被邀请的聚餐日下单和查看订单',
  'regular': '经常参加聚餐的常客，可以在任何聚餐日下单和查看所有订单',
  'chef': '负责做菜的主厨',
  'admin': '系统管理员',
  // 兼容旧角色
  'guest': '旧版访客角色，建议更新'
}

// 角色权限配置
const ROLE_PERMISSIONS = {
  'uninvited_guest': {
    canOrder: false,          // 不能下单
    canViewOrders: false,     // 不能查看订单
    canViewAllOrders: false,  // 不能查看所有订单
    canAccessAllGatheringDays: false, // 不能访问所有聚餐日
    canManageMenu: false,     // 不能管理菜单
    canManageUsers: false,    // 不能管理用户
    canManageOrders: false    // 不能管理订单
  },
  'invited_guest': {
    canOrder: true,           // 可以下单（仅限被邀请的聚餐日）
    canViewOrders: true,      // 可以查看订单（仅限被邀请的聚餐日的所有订单）
    canViewAllOrders: false,  // 不能查看所有订单
    canAccessAllGatheringDays: false, // 不能访问所有聚餐日
    canManageMenu: false,
    canManageUsers: false,
    canManageOrders: false
  },
  'regular': {
    canOrder: true,           // 可以在任何聚餐日下单
    canViewOrders: true,      // 可以查看订单
    canViewAllOrders: true,   // 可以查看所有订单
    canAccessAllGatheringDays: true, // 可以访问所有聚餐日
    canManageMenu: false,
    canManageUsers: false,
    canManageOrders: false
  },
  'chef': {
    canOrder: true,
    canViewOrders: true,
    canViewAllOrders: true,
    canAccessAllGatheringDays: true,
    canManageMenu: true,      // 可以管理菜单
    canManageUsers: false,
    canManageOrders: true     // 可以管理订单
  },
  'admin': {
    canOrder: true,
    canViewOrders: true,
    canViewAllOrders: true,
    canAccessAllGatheringDays: true,
    canManageMenu: true,
    canManageUsers: true,     // 可以管理用户
    canManageOrders: true
  },
  // 兼容旧角色 - 给予常客权限
  'guest': {
    canOrder: true,
    canViewOrders: true,
    canViewAllOrders: true,
    canAccessAllGatheringDays: true,
    canManageMenu: false,
    canManageUsers: false,
    canManageOrders: false
  }
}

/**
 * 获取角色显示名称
 */
function getRoleName(role) {
  return ROLE_NAMES[role] || '未知角色'
}

/**
 * 获取角色描述
 */
function getRoleDescription(role) {
  return ROLE_DESCRIPTIONS[role] || ''
}

/**
 * 检查角色权限
 */
function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) return false
  return permissions[permission] || false
}

/**
 * 获取所有角色列表（用于选择器）
 */
function getAllRoles() {
  return [
    { value: 'uninvited_guest', label: '未受邀访客', description: '新用户，暂未受邀参加聚餐' },
    { value: 'invited_guest', label: '受邀访客', description: '已受邀参加聚餐的访客' },
    { value: 'regular', label: '常客', description: '经常参加聚餐的常客' },
    { value: 'chef', label: '主厨', description: '负责做菜的主厨' },
    { value: 'admin', label: '管理员', description: '系统管理员' }
  ]
}

module.exports = {
  ROLES,
  ROLE_NAMES,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  getRoleName,
  getRoleDescription,
  hasPermission,
  getAllRoles
}
