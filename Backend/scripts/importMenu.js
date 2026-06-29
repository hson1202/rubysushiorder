/**
 * Import menu from Backend/data/menu.json into MongoDB.
 *
 * Usage (from Backend folder):
 *   node scripts/importMenu.js              # upsert by SKU (default)
 *   node scripts/importMenu.js --dry-run      # preview only
 *   node scripts/importMenu.js --replace-all  # delete all foods + all categories first
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import categoryModel from '../models/categoryModel.js'
import foodModel from '../models/foodModel.js'
import { collectAllergens } from '../utils/allergens.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MENU_PATH = path.join(__dirname, '../data/menu.json')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const REPLACE_ALL = args.includes('--replace-all')

const warnings = []

function warn(msg) {
  warnings.push(msg)
}

/** Extract all numeric HUF values from a price string. */
function extractPrices(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return []

  // Prefer amounts explicitly marked with Ft (avoids "0.5l" → 0)
  const ftMatches = priceStr.match(/\d{3,}\s*Ft/gi) || []
  if (ftMatches.length) {
    return ftMatches
      .map((m) => parseInt(m.replace(/\s*Ft/i, ''), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
  }

  // Range without Ft suffix: "690-990"
  const rangeMatch = priceStr.match(/(\d{3,})\s*-\s*(\d{3,})/)
  if (rangeMatch) {
    return [parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)].filter((n) => n > 0)
  }

  return []
}

/** Parse a simple price like "2290 Ft" → 2290 */
function parseSimplePrice(priceStr) {
  const prices = extractPrices(priceStr)
  return prices.length ? prices[0] : 0
}

/** Detect dual uramaki-style price: "2990 Ft / 4690 Ft" with 4db/8db in name */
function parseDualSizePrice(priceStr, item) {
  if (!priceStr || typeof priceStr !== 'string') return null
  const name = `${item.name?.hu || ''} ${item.name?.en || ''}`
  const isPieceSize = /\((4\s*db|4\s*pcs|8\s*db|8\s*pcs)/i.test(name)
  if (!isPieceSize) return null

  const prices = extractPrices(priceStr)
  if (prices.length === 2 && priceStr.includes('/')) {
    return { small: prices[0], large: prices[1] }
  }
  return null
}

function resolvePriceAndOptions(item) {
  let options = []
  let price = 0
  let portion = item.portion || ''
  let description = item.description?.hu || item.description?.en || ''

  if (Array.isArray(item.variants) && item.variants.length > 0) {
    warn(`Unexpected variants for ${item.sku} (${item.id}) - flatten menu data before import`)
  }

  const dual = parseDualSizePrice(item.price, item)
  if (dual) {
    price = dual.small
    warn(`Unexpected dual-size price for ${item.sku} (${item.id}) - flatten menu data before import`)
    return { price, options, portion, description }
  }

  const allPrices = extractPrices(item.price)
  if (allPrices.length > 1) {
    price = Math.min(...allPrices)
    const priceNote = item.price.trim()
    if (!portion.includes(priceNote)) {
      portion = portion ? `${portion} | ${priceNote}` : priceNote
    }
    warn(`Complex price for ${item.sku} (${item.id}): "${item.price}" → using min ${price} HUF`)
  } else if (allPrices.length === 1) {
    price = allPrices[0]
  } else if (item.price) {
    warn(`Could not parse price for ${item.sku} (${item.id}): "${item.price}"`)
  }

  return { price, options, portion, description }
}

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
        amount: parseInt(priceMatch[1], 10),
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

function transformItem(item, categoryId, categoryImage) {
  const { price, options, portion, description } = resolvePriceAndOptions(item)

  if (!price && options.length === 0) {
    warn(`No price for ${item.sku} (${item.id})`)
  }

  return {
    sku: item.sku,
    slug: item.id,
    name: item.name?.hu || item.name?.en || item.id,
    nameHU: item.name?.hu || '',
    nameEN: item.name?.en || '',
    nameVI: item.name?.en || '',
    description: description || 'No description provided',
    portion,
    price: price || 0,
    image: item.image || categoryImage || '',
    category: categoryId,
    quantity: 999,
    status: 'active',
    allergens: collectAllergens(item),
    isRecommended: !!item.featured,
    recommendPriority: item.featured ? 10 : 999,
    options,
  }
}

async function upsertCategory(cat, sortOrder, dryRun) {
  const name = cat.label?.hu || cat.label?.en || cat.id
  const doc = {
    name,
    description: cat.description?.hu || cat.description?.en || '',
    image: cat.image || '',
    sortOrder,
    language: 'hu',
    isActive: true,
  }

  if (dryRun) {
    return { _id: `dry-run-${cat.id}`, ...doc }
  }

  const result = await categoryModel.findOneAndUpdate(
    { name, language: 'hu' },
    { $set: doc },
    { upsert: true, new: true, runValidators: true }
  )
  return result
}

async function upsertFood(foodDoc, dryRun) {
  if (dryRun) return { upserted: true, sku: foodDoc.sku }

  const result = await foodModel.findOneAndUpdate(
    { sku: foodDoc.sku },
    { $set: foodDoc },
    { upsert: true, new: true, runValidators: true }
  )
  return result
}

async function importMenu() {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI
  if (!mongoUrl) {
    console.error('❌ MONGODB_URL or MONGODB_URI is not set')
    process.exit(1)
  }

  if (!fs.existsSync(MENU_PATH)) {
    console.error(`❌ Menu file not found: ${MENU_PATH}`)
    process.exit(1)
  }

  const menu = JSON.parse(fs.readFileSync(MENU_PATH, 'utf8'))
  const categories = menu.categories || []

  console.log(`📂 Loaded menu.json: ${categories.length} categories`)
  if (DRY_RUN) console.log('🔍 DRY RUN – no database writes\n')
  if (REPLACE_ALL && !DRY_RUN) console.log('⚠️  REPLACE ALL – deleting existing foods and all categories\n')

  const cleanMongoUrl = mongoUrl.replace(/[?&]appName=[^&]*/g, '').replace(/[?&]$/, '')
  await mongoose.connect(cleanMongoUrl, { retryWrites: true, w: 'majority' })
  console.log('✅ Connected to MongoDB\n')

  if (REPLACE_ALL && !DRY_RUN) {
    const foodDel = await foodModel.deleteMany({})
    const catDel = await categoryModel.deleteMany({})
    console.log(`🗑️  Deleted ${foodDel.deletedCount} foods, ${catDel.deletedCount} categories\n`)
  }

  const categoryIdBySlug = {}
  let categoryCount = 0

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]
    const saved = await upsertCategory(cat, i, DRY_RUN)
    categoryIdBySlug[cat.id] = saved._id.toString()
    categoryCount++
    console.log(`  📁 Category [${i + 1}/${categories.length}]: ${saved.name} (${cat.id})`)
  }

  let foodCount = 0
  let optionCount = 0

  for (const cat of categories) {
    const categoryId = categoryIdBySlug[cat.id]
    const items = (cat.items || []).flatMap(expandMenuItem)

    for (const item of items) {
      if (!item.sku) {
        warn(`Skipping item without SKU in category ${cat.id}: ${item.id}`)
        continue
      }

      const foodDoc = transformItem(item, categoryId, cat.image)
      await upsertFood(foodDoc, DRY_RUN)
      foodCount++
      if (foodDoc.options.length > 0) {
        optionCount += foodDoc.options[0].choices.length
      }
      console.log(`  🍣 ${foodDoc.sku} – ${foodDoc.name} (${foodDoc.price} Ft${foodDoc.options.length ? `, ${foodDoc.options[0].choices.length} options` : ''})`)
    }
  }

  console.log('\n📊 IMPORT SUMMARY')
  console.log('=================')
  console.log(`Categories: ${categoryCount}`)
  console.log(`Products:   ${foodCount}`)
  console.log(`Variant choices: ${optionCount}`)
  console.log(`Warnings:   ${warnings.length}`)

  if (warnings.length) {
    console.log('\n⚠️  Warnings:')
    warnings.forEach((w) => console.log(`  - ${w}`))
  }

  if (DRY_RUN) {
    console.log('\n✅ Dry run complete – no changes written.')
  } else {
    console.log('\n✅ Import complete.')
  }
}

importMenu()
  .catch((err) => {
    console.error('❌ Import failed:', err.message)
    if (err.errors) {
      Object.values(err.errors).forEach((e) => console.error('  ', e.message))
    }
    process.exit(1)
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close()
      console.log('\n🔌 Database connection closed')
    }
    process.exit(0)
  })
