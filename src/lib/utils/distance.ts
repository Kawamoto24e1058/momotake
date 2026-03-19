/**
 * 2地点間の直線距離を計算します（Haversine公式を使用）
 * @param lat1 地点1の緯度
 * @param lng1 地点1の経度
 * @param lat2 地点2の緯度
 * @param lng2 地点2の経度
 * @returns 距離 (km)
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // 地球の半径 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 距離に基づいて報酬額を算出します
 * ロジック: 基本料金200円 ＋ 1kmごとに100円（小数点以下切り捨て）
 * @param distanceKm 距離 (km)
 * @returns 報酬額 (円)
 */
export function calculateReward(distanceKm: number): number {
  const basePrice = 200;
  const pricePerKm = 100;
  return basePrice + Math.floor(distanceKm) * pricePerKm;
}
