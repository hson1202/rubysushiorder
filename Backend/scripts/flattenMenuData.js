import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MENU_PATH = path.join(__dirname, '../data/menu.json')

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeForCompare(value) {
  return normalizeSlug(value).replace(/-/g, '')
}

function composeName(baseName, label) {
  if (!label) return baseName
  if (!baseName) return label

  const base = normalizeForCompare(baseName)
  const variant = normalizeForCompare(label)
  return variant.includes(base) ? label : `${baseName} - ${label}`
}

function stripCombinedPortionName(name) {
  return String(name || '')
    .replace(/\s*\((?:4\s*(?:db|pcs)\s*\/\s*8\s*(?:db|pcs)|4db\s*\/\s*8db|4\s*pcs\s*\/\s*8\s*pcs)\)\s*/i, '')
    .trim()
}

function priceSegments(priceStr) {
  if (!priceStr || typeof priceStr !== 'string' || !priceStr.includes('/')) return []

  return priceStr
    .split('/')
    .map((segment) => {
      const priceMatch = segment.match(/(\d{3,})\s*Ft/i)
      if (!priceMatch) return null

      const label = segment
        .replace(priceMatch[0], '')
        .trim()
        .replace(/^\(|\)$/g, '')

      return {
        label,
        price: `${priceMatch[1]} Ft`,
      }
    })
    .filter(Boolean)
}

function deriveSegmentLabels(item, segments) {
  const huName = item.name?.hu || ''
  const enName = item.name?.en || ''
  const combined = `${huName} ${enName}`

  if (segments.length === 2 && /4\s*(db|pcs)\s*\/\s*8\s*(db|pcs)|4db\s*\/\s*8db/i.test(combined)) {
    return [
      { hu: '4 db', en: '4 pcs', skuSuffix: '4', portion: '4 pcs / 4 db' },
      { hu: '8 db', en: '8 pcs', skuSuffix: '8', portion: '8 pcs / 8 db' },
    ]
  }

  return segments.map((segment, index) => {
    const label = segment.label || `${index + 1}`
    return {
      hu: label,
      en: label,
      skuSuffix: normalizeSlug(label) || `${index + 1}`,
      portion: label,
    }
  })
}

function expandVariantItem(item) {
  return item.variants.map((variant, index) => {
    const labelHU = variant.label?.hu || variant.label?.en || variant.sku || `${index + 1}`
    const labelEN = variant.label?.en || variant.label?.hu || variant.sku || `${index + 1}`
    const sku = variant.sku || `${item.sku}-${index + 1}`

    const expanded = {
      ...item,
      id: `${item.id}-${normalizeSlug(labelEN || labelHU || sku)}`,
      nameKey: variant.labelKey || item.nameKey,
      price: variant.price || item.price,
      allergenCodes: variant.allergenCodes || item.allergenCodes || [],
      image: variant.image || item.image,
      sku,
      name: {
        hu: composeName(item.name?.hu, labelHU),
        en: composeName(item.name?.en, labelEN),
      },
      description: variant.description || item.description,
      portion: variant.portion || item.portion || '',
    }

    delete expanded.variants
    return expanded
  })
}

function expandSegmentedPriceItem(item) {
  const segments = priceSegments(item.price)
  if (segments.length < 2) return [item]

  const labels = deriveSegmentLabels(item, segments)
  return segments.map((segment, index) => {
    const label = labels[index]
    const baseHu = stripCombinedPortionName(item.name?.hu || item.id)
    const baseEn = stripCombinedPortionName(item.name?.en || item.name?.hu || item.id)
    const skuSuffix = label.skuSuffix || `${index + 1}`

    return {
      ...item,
      id: `${item.id}-${skuSuffix}`,
      sku: `${item.sku}-${skuSuffix.toUpperCase()}`,
      name: {
        hu: `${baseHu} (${label.hu})`,
        en: `${baseEn} (${label.en})`,
      },
      price: segment.price,
      portion: label.portion,
    }
  })
}

function expandMenuItem(item) {
  if (Array.isArray(item.variants) && item.variants.length > 0) {
    return expandVariantItem(item).flatMap(expandSegmentedPriceItem)
  }

  return expandSegmentedPriceItem(item)
}

const menu = JSON.parse(fs.readFileSync(MENU_PATH, 'utf8'))

let originalItems = 0
let flattenedItems = 0
let variantParents = 0
let segmentedPriceItems = 0

for (const category of menu.categories || []) {
  const nextItems = []

  for (const item of category.items || []) {
    originalItems++
    if (Array.isArray(item.variants) && item.variants.length > 0) variantParents++
    if (priceSegments(item.price).length > 1) segmentedPriceItems++

    const expanded = expandMenuItem(item)
    flattenedItems += expanded.length
    nextItems.push(...expanded)
  }

  category.items = nextItems
}

const seenSkus = new Set()
const duplicateSkus = []

for (const category of menu.categories || []) {
  for (const item of category.items || []) {
    if (!item.sku) {
      duplicateSkus.push(`missing sku: ${category.id}/${item.id}`)
      continue
    }

    if (seenSkus.has(item.sku)) duplicateSkus.push(item.sku)
    seenSkus.add(item.sku)
  }
}

if (duplicateSkus.length > 0) {
  console.error('Duplicate or missing SKUs found:')
  duplicateSkus.forEach((sku) => console.error(`- ${sku}`))
  process.exit(1)
}

fs.writeFileSync(MENU_PATH, `${JSON.stringify(menu, null, 2)}\n`)

console.log(`Flattened menu data: ${originalItems} items -> ${flattenedItems} items`)
console.log(`Variant parents flattened: ${variantParents}`)
console.log(`Segmented price items flattened: ${segmentedPriceItems}`)
