import config from '../config/config'

export const resolveMediaUrl = (raw) => {
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw
  const base = String(config.BACKEND_URL || '').replace(/\/+$/, '')
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

export const withCacheBust = (url, version) => {
  if (!url) return ''
  const v = version ? new Date(version).getTime() : Date.now()
  return `${url}${url.includes('?') ? '&' : '?'}v=${v}`
}

export const updateFavicon = (rawUrl, version) => {
  if (!rawUrl) return

  const href = withCacheBust(resolveMediaUrl(rawUrl), version)
  document
    .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .forEach((el) => el.remove())

  const link = document.createElement('link')
  link.id = 'admin-favicon'
  link.rel = 'icon'
  link.href = href
  document.head.appendChild(link)
}

export const updateDocumentBranding = (data) => {
  if (!data) return

  const name = data.restaurantName || ''
  const iconSource = data.logoUrl || data.faviconUrl || ''
  const version = data.updatedAt

  if (name) {
    document.title = `${name} Admin`
  }

  if (iconSource) {
    updateFavicon(iconSource, version)
  }
}
