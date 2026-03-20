/**
 * プラットフォーム利用料（運営手数料）を計算します
 * ルール: 謝礼額（チップ）の 10%、ただし最低 50円
 * @param reward 謝礼額 (円)
 * @returns 手数料 (円)
 */
export function calculatePlatformFee(reward: number): number {
  const minFee = 50;
  const percentage = 0.10;
  const calculatedFee = Math.floor(reward * percentage);
  return Math.max(minFee, calculatedFee);
}
