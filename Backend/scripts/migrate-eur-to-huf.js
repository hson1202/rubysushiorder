/**
 * One-time migration: convert legacy EUR prices to HUF (×400 by default).
 * Run from Backend folder: node scripts/migrate-eur-to-huf.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { EUR_TO_HUF } from '../utils/currency.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const uri = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
if (!uri) {
  console.error('Missing MONGODB_URL');
  process.exit(1);
}

const convert = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return value;
  if (n >= 500) return n; // already migrated
  return Math.round(n * EUR_TO_HUF);
};

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const sample = await db.collection('foods').findOne({}, { projection: { price: 1 } });
  if (sample?.price >= 500) {
    console.log('Prices already look like HUF (sample price:', sample.price, '). Skipping migration.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Converting EUR → HUF at rate ${EUR_TO_HUF}...`);

  const foods = await db.collection('foods').find({}).toArray();
  let foodCount = 0;
  for (const food of foods) {
    const update = {};
    if (food.price != null) update.price = convert(food.price);
    if (food.promotionPrice != null) update.promotionPrice = convert(food.promotionPrice);
    if (Array.isArray(food.options)) {
      update.options = food.options.map((opt) => ({
        ...opt,
        choices: (opt.choices || []).map((ch) => ({
          ...ch,
          price: ch.price != null ? convert(ch.price) : ch.price,
        })),
      }));
    }
    if (Object.keys(update).length) {
      await db.collection('foods').updateOne({ _id: food._id }, { $set: update });
      foodCount++;
    }
  }
  console.log('foods migrated:', foodCount);

  const zones = await db.collection('deliveryzones').find({}).toArray();
  let zoneCount = 0;
  for (const zone of zones) {
    const update = {};
    if (zone.deliveryFee != null && zone.deliveryFee < 500) update.deliveryFee = convert(zone.deliveryFee);
    if (zone.minOrder != null && zone.minOrder < 500) update.minOrder = convert(zone.minOrder);
    if (Object.keys(update).length) {
      await db.collection('deliveryzones').updateOne({ _id: zone._id }, { $set: update });
      zoneCount++;
    }
  }
  console.log('delivery zones migrated:', zoneCount);

  const locations = await db.collection('restaurantlocations').find({}).toArray();
  let locCount = 0;
  for (const loc of locations) {
    if (loc.boxFee != null && loc.boxFee < 10) {
      await db.collection('restaurantlocations').updateOne(
        { _id: loc._id },
        { $set: { boxFee: convert(loc.boxFee) } }
      );
      locCount++;
    }
  }
  console.log('restaurant locations migrated:', locCount);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
