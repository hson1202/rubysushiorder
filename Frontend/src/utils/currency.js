const EUR_TO_HUF = 400;

export const toHuf = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
};

export const formatHuf = (amount) => {
  const n = toHuf(amount);
  if (n < 0) return '0 Ft';
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};
