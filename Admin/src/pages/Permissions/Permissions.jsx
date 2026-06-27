import React, { useState, useEffect } from 'react'
import './Permissions.css'
import axios from 'axios'
import { toast } from 'react-toastify'
import config from '../../config/config'
import { useTranslation } from 'react-i18next'

const Permissions = ({ url }) => {
  const { t } = useTranslation()
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [rolePermissions, setRolePermissions] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  const defaultPermissions = [
    { id: 'dashboard_view', name: 'View Dashboard', description: 'Access to view dashboard statistics' },
    { id: 'orders_view', name: 'View Orders', description: 'View all orders' },
    { id: 'orders_edit', name: 'Edit Orders', description: 'Update order status and details' },
    { id: 'products_view', name: 'View Products', description: 'View all products' },
    { id: 'products_create', name: 'Create Products', description: 'Add new products' },
    { id: 'products_edit', name: 'Edit Products', description: 'Modify existing products' },
    { id: 'products_delete', name: 'Delete Products', description: 'Remove products' },
    { id: 'categories_view', name: 'View Categories', description: 'View all categories' },
    { id: 'categories_create', name: 'Create Categories', description: 'Add new categories' },
    { id: 'categories_edit', name: 'Edit Categories', description: 'Modify existing categories' },
    { id: 'categories_delete', name: 'Delete Categories', description: 'Remove categories' },
    { id: 'users_view', name: 'View Users', description: 'View all users' },
    { id: 'users_edit', name: 'Edit Users', description: 'Modify user details and roles' },
    { id: 'users_delete', name: 'Delete Users', description: 'Remove users' },
    { id: 'permissions_manage', name: 'Manage Permissions', description: 'Configure role permissions' }
  ]

  useEffect(() => {
    fetchRoles()
    fetchPermissions()
  }, [])

  const fetchRoles = async () => {
    try {
      const response = await axios.get(`${config.BACKEND_URL}/api/admin/roles`)
      setRoles(response.data)
    } catch (error) {
      console.error('Error fetching roles:', error)
      // Use default roles if API not available
      setRoles([
        { id: 'user', name: 'User', description: 'Regular user with basic access' },
        { id: 'moderator', name: 'Moderator', description: 'User with moderate administrative access' },
        { id: 'admin', name: 'Admin', description: 'Full administrative access' }
      ])
    }
  }

  const fetchPermissions = async () => {
    try {
      const response = await axios.get(`${config.BACKEND_URL}/api/admin/permissions`)
      setPermissions(response.data)
    } catch (error) {
      console.error('Error fetching permissions:', error)
      setPermissions(defaultPermissions)
    }
  }

  const handlePermissionToggle = async (roleId, permissionId, isGranted) => {
    try {
      await axios.put(`${config.BACKEND_URL}/api/admin/roles/${roleId}/permissions`, {
        permissionId,
        granted: !isGranted
      })
      toast.success('Permission updated successfully')
      fetchRolePermissions()
    } catch (error) {
      console.error('Error updating permission:', error)
      toast.error('Failed to update permission')
    }
  }

  const fetchRolePermissions = async () => {
    try {
      const response = await axios.get(`${config.BACKEND_URL}/api/admin/role-permissions`)
      setRolePermissions(response.data)
    } catch (error) {
      console.error('Error fetching role permissions:', error)
      // Set default permissions
      setRolePermissions({
        user: ['dashboard_view', 'orders_view'],
        moderator: ['dashboard_view', 'orders_view', 'orders_edit', 'products_view', 'products_edit', 'categories_view', 'categories_edit'],
        admin: defaultPermissions.map(p => p.id)
      })
    }
  }

  const isPermissionGranted = (roleId, permissionId) => {
    return rolePermissions[roleId]?.includes(permissionId) || false
  }

  const getRoleColor = (roleId) => {
    switch (roleId) {
      case 'admin': return '#e74c3c'
      case 'moderator': return '#f39c12'
      case 'user': return '#3498db'
      default: return '#95a5a6'
    }
  }

  return (
    <div className='permissions-page'>
      <div className="permissions-header">
        <h1>{t('perm.title')}</h1>
        <p>{t('perm.subtitle')}</p>
      </div>

      {/* Roles Overview */}
      <div className="roles-overview">
        <h2>{t('perm.roles')}</h2>
        <div className="roles-grid">
          {roles.map((role) => (
            <div key={role.id} className="role-card" style={{ borderLeftColor: getRoleColor(role.id) }}>
              <h3>{role.name}</h3>
              <p>{role.description}</p>
              <div className="role-stats">
                <span>{rolePermissions[role.id]?.length || 0} {t('perm.permissions')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="permissions-matrix">
        <h2>{t('perm.permissionsMatrix')}</h2>
        <div className="matrix-container">
          <table className="permissions-table">
            <thead>
              <tr>
                <th>{t('perm.permission')}</th>
                {roles.map((role) => (
                  <th key={role.id} style={{ backgroundColor: getRoleColor(role.id) }}>
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission.id}>
                  <td className="permission-info" data-label={t('perm.permission')}>
                    <div className="permission-name">{permission.name}</div>
                    <div className="permission-description">{permission.description}</div>
                  </td>
                  {roles.map((role) => (
                    <td
                      key={`${permission.id}-${role.id}`}
                      className="permission-cell"
                      data-role={role.name}
                    >
                      <label className="permission-toggle">
                        <input
                          type="checkbox"
                          checked={isPermissionGranted(role.id, permission.id)}
                          onChange={() => handlePermissionToggle(role.id, permission.id, isPermissionGranted(role.id, permission.id))}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Groups */}
      <div className="permission-groups">
        <h2>{t('perm.permissionGroups')}</h2>
        <div className="groups-grid">
          <div className="group-card">
            <h3>Dashboard Access</h3>
            <ul>
              <li>View Dashboard</li>
            </ul>
          </div>
          <div className="group-card">
            <h3>Order Management</h3>
            <ul>
              <li>View Orders</li>
              <li>Edit Orders</li>
            </ul>
          </div>
          <div className="group-card">
            <h3>Product Management</h3>
            <ul>
              <li>View Products</li>
              <li>Create Products</li>
              <li>Edit Products</li>
              <li>Delete Products</li>
            </ul>
          </div>
          <div className="group-card">
            <h3>Category Management</h3>
            <ul>
              <li>View Categories</li>
              <li>Create Categories</li>
              <li>Edit Categories</li>
              <li>Delete Categories</li>
            </ul>
          </div>
          <div className="group-card">
            <h3>User Management</h3>
            <ul>
              <li>View Users</li>
              <li>Edit Users</li>
              <li>Delete Users</li>
            </ul>
          </div>
          <div className="group-card">
            <h3>System Administration</h3>
            <ul>
              <li>Manage Permissions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Permissions 