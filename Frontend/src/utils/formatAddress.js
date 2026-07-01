// Format một địa chỉ giao hàng (object address của order) thành 1-2 dòng dễ đọc
// cho khách/nhân viên, ví dụ: "12 Andrássy út, 1061 Budapest".
// Dùng chung để tránh lặp lại logic này ở nhiều trang hiển thị đơn hàng
// (TrackOrder, MyOrders, AccountOrdersPage...).
export const formatFullAddress = (addr, { fallback = '' } = {}) => {
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
  const zip = (addr.zipcode || addr.postalCode || '').toString().trim();
  const line2 = [zip, city].filter(Boolean).join(' ');

  return [line1, line2].filter(Boolean).join(', ') || fallback;
};
