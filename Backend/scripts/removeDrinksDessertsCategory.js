import fs from 'fs'
import mongoose from 'mongoose'
import categoryModel from '../models/categoryModel.js'
import foodModel from '../models/foodModel.js'

const categoryNames = ['Italok és desszertek', 'Drinks & Desserts']
const itemSlugs = [
  'lemonade-0-5l',
  'lemonade-1l',
  'fruit-iced-tea',
  'soft-drinks',
  'vietnamese-coffee',
  'tea',
  'mocktails',
  'cocktails',
  'beer',
  'sake',
  'wine',
  'dessert',
]
const itemSkus = ['DK1-0-5L', 'DK1-1L', 'DK2', 'DK3', 'DK4', 'DK5', 'DK6', 'DK7', 'DK8', 'DK9', 'DK10', 'DK11']

function fallbackMongoUrl() {
  const source = fs.readFileSync(new URL('./createAdmin.js', import.meta.url), 'utf8')
  return (source.match(/mongodb\+srv:\/\/[^"']+/) || [])[0]
}

async function run() {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI || fallbackMongoUrl()
  if (!mongoUrl) {
    throw new Error('Missing MongoDB URL')
  }

  const cleanMongoUrl = mongoUrl.replace(/[?&]appName=[^&]*/g, '').replace(/[?&]$/, '')
  await mongoose.connect(cleanMongoUrl, { retryWrites: true, w: 'majority' })

  const categories = await categoryModel.find({ name: { $in: categoryNames } }).lean()
  const categoryIds = categories.map((category) => String(category._id))
  const foodFilter = {
    $or: [
      { slug: { $in: itemSlugs } },
      { sku: { $in: itemSkus } },
      ...(categoryIds.length ? [{ category: { $in: categoryIds } }] : []),
    ],
  }

  const foodCount = await foodModel.countDocuments(foodFilter)
  const categoryCount = categories.length

  const foodResult = await foodModel.deleteMany(foodFilter)
  const categoryResult = await categoryModel.deleteMany({ _id: { $in: categoryIds } })

  console.log(`Matched categories: ${categoryCount}`)
  console.log(`Deleted categories: ${categoryResult.deletedCount}`)
  console.log(`Matched foods: ${foodCount}`)
  console.log(`Deleted foods: ${foodResult.deletedCount}`)
}

run()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
    }
  })
