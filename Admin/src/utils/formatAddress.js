// Format một địa chỉ giao hàng (object address của order) thành 1-2 dòng dễ đọc
// cho nhân viên/admin, ví dụ: "12 Andrássy út, 1061 Budapest".
export const formatFullAddress = (addr, { fallback = 'N/A' } = {}) => {
  if (!addr) return fallback;

  const street = (addr.street || '').trim();
  const house = (addr.houseNumber || '').toString().trim();

  // Tránh lặp số nhà nếu street đã bắt đầu bằng số hoặc đã chứa số nhà đó
  const streetAlreadyHasNumber = /^\d+/.test(street);
  const streetHasHouse = house && street.toLowerCase().includes(house.toLowerCase());
  const line1 = house && street && !streetAlreadyHasNumber && !streetHasHouse
    ? `${house} ${street}`.trim()
    : (street || house);

  const city = (addr.city || '').trim();
  const state = (addr.state || '').trim();
  const zip = (addr.zipcode || addr.postalCode || '').toString().trim();
  const line2 = [zip, city, state].filter(Boolean).join(' ');

  return [line1, line2].filter(Boolean).join(', ') || fallback;
};
