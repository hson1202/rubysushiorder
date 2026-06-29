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
