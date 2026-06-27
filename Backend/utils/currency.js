/** EUR → HUF conversion (legacy DB stored prices in EUR) */
export const EUR_TO_HUF = Number(process.env.EUR_TO_HUF) || 400;

export const toHuf = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
};

export const formatHuf = (amount) =>
  new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toHuf(amount));

/** True when value still looks like a legacy EUR price (pre-migration). */
export const isLegacyEurPrice = (amount) => {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 && n < 500;
};

export const eurToHuf = (eurAmount) => Math.round(Number(eurAmount) * EUR_TO_HUF);
