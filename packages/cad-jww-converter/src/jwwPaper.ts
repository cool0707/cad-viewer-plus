/**
 * Paper sizes Jw_cad stores in the JWW header (`m_nZumen`), in millimetres.
 *
 * Codes 5–7 are unused by Jw_cad. JWW coordinates are paper millimetres with
 * the origin at the centre of the sheet.
 */
const JWW_PAPER_SIZES: Record<number, readonly [number, number]> = {
  0: [1189, 841], // A0
  1: [841, 594], // A1
  2: [594, 420], // A2
  3: [420, 297], // A3
  4: [297, 210], // A4
  8: [1682, 1189], // 2A
  9: [2378, 1682], // 3A
  10: [3364, 2378], // 4A
  11: [4756, 3364], // 5A
  12: [10000, 7071], // 10m
  13: [50000, 35355], // 50m
  14: [100000, 70711] // 100m
}

/**
 * Returns the sheet width / height in paper millimetres for a JWW paper size
 * code, or `undefined` when the code is unknown.
 */
export function jwwPaperSize(
  code: number
): { width: number; height: number } | undefined {
  const size = JWW_PAPER_SIZES[code]
  return size ? { width: size[0], height: size[1] } : undefined
}
