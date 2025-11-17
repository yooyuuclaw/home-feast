// pages/admin/menu-edit/menu-edit.js
const { CATEGORIES } = require('../../../utils/constants.js')
const { uploadImage } = require('../../../utils/util.js')

Page({
  data: {
    isEdit: false,
    dishId: '',
    formData: {
      name: '',
      image: '',
      category: 'cold_dish',
      status: 'online',
      ingredients: []  // 主要食材列表
    },
    categories: CATEGORIES,
    categoryIndex: 0
  },

  onLoad(options) {
    if (options.id) {
      // 编辑模式
      this.setData({
        isEdit: true,
        dishId: options.id
      })
      this.loadDishInfo(options.id)
    }
  },

  /**
   * 加载菜品信息
   */
  async loadDishInfo(id) {
    try {
      wx.showLoading({ title: '加载中...' })

      const res = await wx.cloud.callFunction({
        name: 'menu',
        data: {
          action: 'getList'
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        const dish = res.result.data.find(item => item._id === id)
        if (dish) {
          const categoryIndex = CATEGORIES.findIndex(cat => cat.id === dish.category)
          this.setData({
            formData: {
              name: dish.name,
              image: dish.image,
              category: dish.category,
              status: dish.status,
              ingredients: dish.ingredients || []  // 加载食材列表
            },
            categoryIndex: categoryIndex >= 0 ? categoryIndex : 0
          })
        }
      }
    } catch (err) {
      console.error('加载菜品信息失败', err)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 上传图片
   */
  async uploadImage() {
    try {
      const fileID = await uploadImage()
      this.setData({
        'formData.image': fileID
      })
    } catch (err) {
      console.error('上传图片失败', err)
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      })
    }
  },

  /**
   * 名称输入
   */
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    })
  },

  /**
   * 分类选择
   */
  onCategoryChange(e) {
    const index = e.detail.value
    this.setData({
      categoryIndex: index,
      'formData.category': CATEGORIES[index].id
    })
  },

  /**
   * 状态切换
   */
  onStatusChange(e) {
    this.setData({
      'formData.status': e.detail.value ? 'online' : 'offline'
    })
  },

  /**
   * 添加食材
   */
  addIngredient() {
    const ingredients = this.data.formData.ingredients || []
    ingredients.push('')
    this.setData({
      'formData.ingredients': ingredients
    })
  },

  /**
   * 食材输入
   */
  onIngredientInput(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    const ingredients = this.data.formData.ingredients
    ingredients[index] = value
    this.setData({
      'formData.ingredients': ingredients
    })
  },

  /**
   * 删除食材
   */
  deleteIngredient(e) {
    const index = e.currentTarget.dataset.index
    const ingredients = this.data.formData.ingredients
    ingredients.splice(index, 1)
    this.setData({
      'formData.ingredients': ingredients
    })
  },

  /**
   * 提交表单
   */
  async submitForm() {
    const { formData, isEdit, dishId } = this.data

    // 验证表单
    if (!formData.name) {
      wx.showToast({
        title: '请输入菜品名称',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: isEdit ? '保存中...' : '添加中...' })

      // 过滤掉空的食材
      const filteredIngredients = (formData.ingredients || []).filter(ing => ing.trim() !== '')

      const data = {
        action: isEdit ? 'update' : 'add',
        name: formData.name,
        category: formData.category,
        status: formData.status,
        ingredients: filteredIngredients  // 添加食材列表
      }

      if (formData.image) {
        data.image = formData.image
      }

      if (isEdit) {
        data.id = dishId
      }

      const res = await wx.cloud.callFunction({
        name: 'menu',
        data: data
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: isEdit ? '保存成功' : '添加成功',
          icon: 'success'
        })

        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      console.error('提交失败', err)
      wx.hideLoading()
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  /**
   * 取消
   */
  cancel() {
    wx.navigateBack()
  }
})
