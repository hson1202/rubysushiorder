// Các hàm xử lý/format địa chỉ dùng chung cho toàn backend (delivery geocoding,
// email đơn hàng, v.v.) để tránh lặp lại logic này ở nhiều file.

// Parse địa chỉ từ Nominatim (OpenStreetMap) response format
export const extractAddressComponents = (nominatimResult = {}) => {
  const components = {
    street: "",
    streetLine: "",
    houseNumber: "",
    city: "",
    village: "", // Thành phố nhỏ (ví dụ: Veča)
    town: "", // Thành phố lớn hơn (ví dụ: Budapest)
    state: "",
    zipcode: "",
    country: "",
  };

  const address = nominatimResult.address || {};

  // Số nhà
  components.houseNumber =
    address.house_number ||
    address.house ||
    address.housenumber ||
    "";

  // Tên đường
  components.street =
    address.road ||
    address.street ||
    address.pedestrian ||
    address.path ||
    "";

  // Village (thành phố nhỏ / ngoại ô, ví dụ: Óbuda)
  components.village = address.village || "";

  // Town/City (thành phố lớn hơn, ví dụ: Budapest)
  components.town = address.town || address.city || "";

  // City (fallback - dùng village hoặc town nếu không có)
  components.city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    "";

  // Tỉnh/Quận/Huyện
  components.state =
    address.state ||
    address.region ||
    address.county ||
    "";

  // Mã bưu điện
  components.zipcode = address.postcode || "";

  // Quốc gia
  components.country = address.country || "";

  // Tạo streetLine: kết hợp số nhà + tên đường
  components.streetLine = [components.houseNumber, components.street]
    .filter(Boolean)
    .join(" ")
    .trim();

  // Fallback: Nếu không có streetLine, thử parse từ display_name
  if (!components.streetLine && nominatimResult.display_name) {
    const displayName = nominatimResult.display_name;
    // Thử tách số nhà từ đầu chuỗi (ví dụ: "1870/19, Hliník" hoặc "Hliník 1870/19")
    const match = displayName.match(/^(\d+[\/\-\d]*[a-zA-Z]?)\s+(.+?)(?:,|$)/);
    if (match) {
      components.houseNumber = components.houseNumber || match[1];
      components.street = components.street || match[2].trim();
      components.streetLine = [components.houseNumber, components.street]
        .filter(Boolean)
        .join(" ")
        .trim();
    } else {
      // Thử pattern ngược lại: "Hliník 1870/19"
      const reverseMatch = displayName.match(/^(.+?)\s+(\d+[\/\-\d]*[a-zA-Z]?)(?:,|$)/);
      if (reverseMatch) {
        components.street = components.street || reverseMatch[1].trim();
        components.houseNumber = components.houseNumber || reverseMatch[2];
        components.streetLine = [components.street, components.houseNumber]
          .filter(Boolean)
          .join(" ")
          .trim();
      } else {
        // Lấy phần đầu tiên trước dấu phẩy
        components.streetLine = displayName.split(',')[0].trim();
      }
    }
  }

  return components;
};

// Format địa chỉ ngắn gọn từ components
// Ví dụ: "Bajcsy-Zsilinszky út 12, 1051 Budapest"
// Bỏ qua state/region và country để tránh lặp lại thông tin
export const formatShortAddress = (components = {}) => {
  const parts = [];

  // Phần 1: Street line (số nhà + tên đường)
  if (components.streetLine) {
    parts.push(components.streetLine);
  } else if (components.street) {
    parts.push(components.street);
  }

  // Phần 2: Village (thành phố nhỏ / ngoại ô, ví dụ: Óbuda)
  if (components.village && components.village !== components.town) {
    parts.push(components.village);
  }

  // Phần 3: Zipcode + Town (thành phố lớn hơn, ví dụ: 1051 Budapest)
  if (components.zipcode && components.town) {
    // Kết hợp zipcode và town nếu town khác với village
    const zipAndTown = `${components.zipcode} ${components.town}`;
    // Kiểm tra xem town đã có trong parts chưa (tránh lặp)
    const townAlreadyIncluded = parts.some(part => part.includes(components.town));
    if (!townAlreadyIncluded) {
      parts.push(zipAndTown);
    } else {
      // Nếu đã có town ở trên, chỉ thêm zipcode nếu chưa có
      const zipcodeAlreadyIncluded = parts.some(part => part.includes(components.zipcode));
      if (!zipcodeAlreadyIncluded) {
        parts.push(components.zipcode);
      }
    }
  } else if (components.zipcode) {
    // Chỉ có zipcode, không có town
    const zipcodeAlreadyIncluded = parts.some(part => part.includes(components.zipcode));
    if (!zipcodeAlreadyIncluded) {
      parts.push(components.zipcode);
    }
  } else if (components.town && !components.village) {
    // Chỉ có town, không có village
    const townAlreadyIncluded = parts.some(part => part.includes(components.town));
    if (!townAlreadyIncluded) {
      parts.push(components.town);
    }
  } else if (components.city && !components.village && !components.town) {
    // Fallback: dùng city nếu không có village và town
    const cityAlreadyIncluded = parts.some(part => part.includes(components.city));
    if (!cityAlreadyIncluded) {
      parts.push(components.city);
    }
  }

  // KHÔNG thêm state/region và country để tránh lặp lại thông tin
  // (ví dụ: "Region of Nitra 927 01" sẽ bị bỏ qua)

  // Nếu không có gì, trả về empty string
  if (parts.length === 0) {
    return "";
  }

  return parts.join(", ");
};

// Clean display_name để bỏ phần state/region và country
// Ví dụ: "Bajcsy-Zsilinszky út 12, 1051 Budapest, Budapest, Hungary"
// -> "Bajcsy-Zsilinszky út 12, 1051 Budapest"
export const cleanDisplayName = (displayName = "") => {
  if (!displayName) return "";

  // Tách địa chỉ thành các phần
  const parts = displayName.split(',').map(part => part.trim()).filter(Boolean);

  // Loại bỏ các phần chứa "Region of", "State", "Country", "Hungary"
  const cleanedParts = parts.filter(part => {
    const lowerPart = part.toLowerCase();
    // Bỏ qua các phần chứa từ khóa region/state/country
    if (lowerPart.includes('region of') ||
      lowerPart.includes('state') ||
      (lowerPart.includes('country') && !lowerPart.match(/\d/)) || // Bỏ "country" nhưng giữ nếu có số
      lowerPart === 'hungary' || lowerPart === 'magyarország') {
      return false;
    }
    return true;
  });

  // Loại bỏ các phần trùng lặp (ví dụ: "Budapest" xuất hiện 2 lần)
  // Ưu tiên giữ phần có zipcode (ví dụ: "1051 Budapest" thay vì chỉ "Budapest")
  const uniqueParts = [];
  const seenWords = new Set();

  // Đầu tiên, thêm các phần có zipcode (chứa số)
  for (const part of cleanedParts) {
    if (/\d/.test(part)) {
      uniqueParts.push(part);
      // Thêm các từ quan trọng vào seen (bỏ qua số và từ ngắn)
      part.split(/\s+/).forEach(word => {
        if (word.length >= 3 && !/\d/.test(word)) {
          seenWords.add(word.toLowerCase());
        }
      });
    }
  }

  // Sau đó, thêm các phần không có zipcode nhưng chưa bị trùng
  for (const part of cleanedParts) {
    if (!/\d/.test(part)) {
      const partWords = part.split(/\s+/).filter(w => w.length >= 3);
      const isDuplicate = partWords.some(word => seenWords.has(word.toLowerCase()));
      if (!isDuplicate) {
        uniqueParts.push(part);
        partWords.forEach(word => {
          seenWords.add(word.toLowerCase());
        });
      }
    }
  }

  return uniqueParts.join(", ");
};

// Ghép số nhà + tên đường thành 1 dòng cho email/PDF, tránh lặp số nhà nếu
// street đã chứa nó (dùng cho order.address đã lưu trong DB)
export const formatOrderStreetLine = (address = {}) => {
  const street = (address.street || '').toString().trim();
  const house = (address.houseNumber || '').toString().trim();
  if (!street && !house) return '';
  if (!house) return street;
  const streetAlreadyHasNumber = /^\d+/.test(street);
  const streetHasHouse = street && street.toLowerCase().includes(house.toLowerCase());
  if (streetAlreadyHasNumber || streetHasHouse) return street || house;
  return `${house} ${street}`.trim();
};
