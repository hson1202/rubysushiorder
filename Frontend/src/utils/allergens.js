// EU 14 allergens shared config for the public storefront.
// Keep codes in sync with Admin/src/utils/allergens.js
export const ALLERGENS = {
  gluten: { icon: '🌾', labelEN: 'Gluten', labelVI: 'Gluten', labelHU: 'Glutén' },
  crustaceans: { icon: '🦐', labelEN: 'Crustaceans', labelVI: 'Giáp xác', labelHU: 'Rákfélék' },
  egg: { icon: '🥚', labelEN: 'Egg', labelVI: 'Trứng', labelHU: 'Tojás' },
  fish: { icon: '🐟', labelEN: 'Fish', labelVI: 'Cá', labelHU: 'Hal' },
  peanut: { icon: '🥜', labelEN: 'Peanut', labelVI: 'Đậu phộng', labelHU: 'Földimogyoró' },
  soy: { icon: '🫘', labelEN: 'Soy', labelVI: 'Đậu nành', labelHU: 'Szója' },
  milk: { icon: '🥛', labelEN: 'Milk', labelVI: 'Sữa', labelHU: 'Tej' },
  nuts: { icon: '🌰', labelEN: 'Nuts', labelVI: 'Các loại hạt', labelHU: 'Diófélék' },
  celery: { icon: '🥬', labelEN: 'Celery', labelVI: 'Cần tây', labelHU: 'Zeller' },
  mustard: { icon: '🟡', labelEN: 'Mustard', labelVI: 'Mù tạt', labelHU: 'Mustár' },
  sesame: { icon: '🌱', labelEN: 'Sesame', labelVI: 'Vừng', labelHU: 'Szezámmag' },
  sulfites: { icon: '🧪', labelEN: 'Sulfites', labelVI: 'Sulfit', labelHU: 'Szulfitok' },
  lupin: { icon: '🌸', labelEN: 'Lupin', labelVI: 'Đậu lupin', labelHU: 'Csillagfürt' },
  molluscs: { icon: '🐚', labelEN: 'Molluscs', labelVI: 'Nhuyễn thể', labelHU: 'Puhatestűek' },
}

// Map legacy EU numeric codes (used by old import scripts) to string codes.
const NUMERIC_TO_CODE = {
  1: 'gluten',
  2: 'crustaceans',
  3: 'egg',
  4: 'fish',
  5: 'peanut',
  6: 'soy',
  7: 'milk',
  8: 'nuts',
  9: 'celery',
  10: 'mustard',
  11: 'sesame',
  12: 'sulfites',
  13: 'lupin',
  14: 'molluscs',
}

// Normalize an allergens value (array of codes or numbers) into known string codes.
export const normalizeAllergens = (allergens) => {
  if (!Array.isArray(allergens)) return []
  return allergens
    .map((a) => {
      if (a === null || a === undefined) return null
      const str = String(a).trim().toLowerCase()
      if (ALLERGENS[str]) return str
      const num = Number(str)
      if (Number.isInteger(num) && NUMERIC_TO_CODE[num]) return NUMERIC_TO_CODE[num]
      return null
    })
    .filter(Boolean)
}

// Get display info for an allergen code in the given language.
export const getAllergenInfo = (code, language = 'en') => {
  const entry = ALLERGENS[code]
  if (!entry) return null
  const langKey = `label${String(language).toUpperCase()}`
  return {
    code,
    icon: entry.icon,
    label: entry[langKey] || entry.labelEN,
  }
}
