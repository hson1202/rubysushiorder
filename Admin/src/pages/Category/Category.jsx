import React, { useState, useEffect } from 'react'
import './Category.css'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import '../../i18n'
import config from '../../config/config'

const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'
const ERROR_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZWJlZSIgc3Ryb2tlPSIjZmY2ODY4IiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgZmlsbD0iI2ZmNjg2OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yPC90ZXh0Pjwvc3ZnPg=='

const Category = ({ url }) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([])
  const [newCategory, setNewCategory] = useState({ name: '', description: '', image: null })
  const [editingCategory, setEditingCategory] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  // Error boundary - after all hooks
  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Something went wrong!</h2>
        <p>{error.message}</p>
        <button onClick={() => setError(null)}>Try again</button>
      </div>
    )
  }

  const resolveImage = (image) => {
    if (!image) return PLACEHOLDER_IMAGE
    if (image.startsWith('http')) return image
    return `${config.BACKEND_URL}${config.IMAGE_PATHS.CATEGORY}/${image}`
  }

  const fetchCategories = async (showLoadingToast = false) => {
    try {
      if (showLoadingToast) {
        toast.info('🔄 Đang tải lại categories...', { autoClose: 1000 })
      }

      const apiUrl = `${config.BACKEND_URL}${config.API_ENDPOINTS.CATEGORY}/admin`
      const response = await axios.get(apiUrl)
      const categoriesData = response.data.data || response.data
      setCategories(categoriesData)

      if (showLoadingToast) {
        toast.success(`✅ Đã tải lại ${categoriesData.length} categories`, { autoClose: 2000 })
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
      setError(error)
      toast.error(t('categories.fetchError', 'Failed to fetch categories'))
    }
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCategory.name.trim()) {
      toast.error(t('categories.nameRequired', 'Category name is required'))
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', newCategory.name)
      formData.append('description', newCategory.description)
      if (newCategory.image) {
        formData.append('image', newCategory.image)
      }

      const apiUrl = `${config.BACKEND_URL}${config.API_ENDPOINTS.CATEGORY}`
      await axios.post(apiUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      })
      toast.success(t('categories.addSuccess', 'Category added successfully'))
      setNewCategory({ name: '', description: '', image: null })
      setShowAddForm(false)
      fetchCategories()
    } catch (error) {
      console.error('Error adding category:', error)
      setError(error)

      if (error.code === 'ECONNABORTED') {
        toast.error('Request timeout - backend không phản hồi. Vui lòng thử lại.')
      } else if (error.response?.status === 404) {
        toast.error('Backend không tìm thấy. Kiểm tra URL: ' + config.BACKEND_URL)
      } else if (error.response?.status >= 500) {
        toast.error('Lỗi server. Vui lòng thử lại sau.')
      } else {
        toast.error(error.response?.data?.message || t('categories.addError', 'Failed to add category'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setNewCategory({ ...newCategory, image: file })
    }
  }

  const handleEditCategory = async (e) => {
    e.preventDefault()
    if (!editingCategory.name.trim()) {
      toast.error(t('categories.nameRequired', 'Category name is required'))
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', editingCategory.name)
      formData.append('description', editingCategory.description)
      if (editingCategory.newImage) {
        formData.append('image', editingCategory.newImage)
      }

      await axios.put(`${config.BACKEND_URL}${config.API_ENDPOINTS.CATEGORY}/${editingCategory._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(t('categories.updateSuccess', 'Category updated successfully'))
      setEditingCategory(null)
      fetchCategories()
    } catch (error) {
      console.error('Error updating category:', error)
      setError(error)
      toast.error(error.response?.data?.message || t('categories.updateError', 'Failed to update category'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm(t('categories.deleteConfirm', 'Are you sure you want to delete this category?'))) {
      try {
        await axios.delete(`${config.BACKEND_URL}${config.API_ENDPOINTS.CATEGORY}/${categoryId}`)
        toast.success(t('categories.deleteSuccess', 'Category deleted successfully'))
        fetchCategories()
      } catch (error) {
        console.error('Error deleting category:', error)
        setError(error)
        toast.error(t('categories.deleteError', 'Failed to delete category'))
      }
    }
  }

  const startEditing = (category) => {
    setEditingCategory({ ...category, newImage: null })
  }

  const cancelEditing = () => {
    setEditingCategory(null)
  }

  // Build sortOrder updates for the whole flat list after swapping two items
  const buildReorderedUpdates = (list, fromIndex, toIndex) => {
    const reordered = [...list]
    const temp = reordered[fromIndex]
    reordered[fromIndex] = reordered[toIndex]
    reordered[toIndex] = temp

    return reordered.map((item, index) => ({
      id: item._id,
      sortOrder: index
    }))
  }

  const moveCategoryUp = async (index) => {
    if (index <= 0) return
    const updates = buildReorderedUpdates(categories, index, index - 1)
    await updateCategorySortOrder(updates)
  }

  const moveCategoryDown = async (index) => {
    if (index >= categories.length - 1) return
    const updates = buildReorderedUpdates(categories, index, index + 1)
    await updateCategorySortOrder(updates)
  }

  const updateCategorySortOrder = async (updates) => {
    try {
      setIsLoading(true)
      const apiUrl = `${config.BACKEND_URL}${config.API_ENDPOINTS.CATEGORY}/bulk-update-order`
      const response = await axios.post(apiUrl, { updates })

      if (response.data.success) {
        toast.success('Đã cập nhật thứ tự thành công!')
        fetchCategories()
      } else {
        toast.error(response.data.message || 'Không thể cập nhật thứ tự')
      }
    } catch (error) {
      console.error('Error updating sort order:', error)
      toast.error('Lỗi khi cập nhật thứ tự')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='category-page'>
      <div className="category-header">
        <div className="header-content">
          <h1>{t('categories.title')}</h1>
          <p>{t('categories.subtitle', 'Manage your food categories')}</p>
        </div>
        <div className="header-actions">
          <button
            className="btn-add-category"
            onClick={() => {
              setShowAddForm(true)
              setTimeout(() => {
                document.getElementById('add-category-form')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                })
              }, 100)
            }}
          >
            ➕ Thêm mới
          </button>
          <button className="refresh-btn" onClick={() => fetchCategories(true)}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Add Category Form */}
      <div className="add-category-section" id="add-category-form">
        <div
          className="add-category-header"
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ marginBottom: showAddForm ? '20px' : '0' }}
        >
          <span className="expand-icon">
            {showAddForm ? '▼' : '▶'}
          </span>
          <h2>Thêm danh mục</h2>
        </div>

        {showAddForm && (
        <form onSubmit={handleAddCategory} className="category-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">{t('categories.name')} *</label>
              <input
                type="text"
                id="name"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder={t('categories.namePlaceholder', 'Enter category name')}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">{t('categories.description')}</label>
              <textarea
                id="description"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder={t('categories.descriptionPlaceholder', 'Enter category description')}
                rows="3"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="image">{t('categories.image')}</label>
            <input
              type="file"
              id="image"
              onChange={handleImageChange}
              accept="image/*"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? t('common.loading') : t('categories.addNew')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setNewCategory({ name: '', description: '', image: null })}
            >
              {t('common.clear')}
            </button>
          </div>
        </form>
        )}
      </div>

      {/* Categories List */}
      <div className="categories-section">
        <div className="categories-section-header">
          <h2>{t('categories.list', 'Categories List')}</h2>
        </div>
        {categories.length === 0 ? (
          <div className="empty-state">
            <h3>{t('categories.noCategoriesTitle', 'No Categories Found')}</h3>
            <p>{t('categories.noCategories', 'Start by adding your first category')}</p>
          </div>
        ) : (
          <div className="categories-container">
            <div className="category-group-list">
              {categories.map((category, index) => (
                <div key={category._id} className="category-list-item">
                  {editingCategory && editingCategory._id === category._id ? (
                    <form onSubmit={handleEditCategory} className="edit-form-inline">
                      <div className="edit-form-content">
                        <div className="form-group-inline">
                          <label>{t('categories.name')}</label>
                          <input
                            type="text"
                            value={editingCategory.name}
                            onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group-inline">
                          <label>{t('categories.description')}</label>
                          <textarea
                            value={editingCategory.description}
                            onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                            rows="2"
                          />
                        </div>
                        <div className="form-group-inline">
                          <label>{t('categories.newImage', 'New Image')}</label>
                          <input
                            type="file"
                            onChange={(e) => setEditingCategory({ ...editingCategory, newImage: e.target.files[0] })}
                            accept="image/*"
                          />
                        </div>
                      </div>
                      <div className="edit-actions-inline">
                        <button type="submit" className="btn-success" disabled={isLoading}>
                          {isLoading ? t('common.loading') : t('common.save')}
                        </button>
                        <button type="button" onClick={cancelEditing} className="btn-secondary">
                          {t('common.cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="category-list-image">
                        <img
                          src={resolveImage(category.image)}
                          alt={category.name}
                          onError={(e) => { e.target.src = ERROR_IMAGE }}
                        />
                      </div>
                      <div className="category-list-info">
                        <h4>{category.name}</h4>
                        <p>{category.description || t('categories.noDescription', 'No description')}</p>
                        <span className="category-sort-number">Order: {category.sortOrder}</span>
                      </div>
                      <div className="category-list-actions">
                        <div className="sort-controls">
                          <button
                            className="btn-sort"
                            onClick={() => moveCategoryUp(index)}
                            disabled={isLoading || index === 0}
                            title="Move up"
                          >
                            ⬆️
                          </button>
                          <button
                            className="btn-sort"
                            onClick={() => moveCategoryDown(index)}
                            disabled={isLoading || index === categories.length - 1}
                            title="Move down"
                          >
                            ⬇️
                          </button>
                        </div>
                        <div className="action-buttons">
                          <button onClick={() => startEditing(category)} className="btn-edit">
                            {t('common.edit')}
                          </button>
                          <button onClick={() => handleDeleteCategory(category._id)} className="btn-delete">
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Category
