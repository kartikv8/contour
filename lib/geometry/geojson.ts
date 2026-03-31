export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && isNumber(value[0]) && isNumber(value[1]);
}

export function toLngLatPair(pair: [number, number]): [number, number] {
  return [pair[0], pair[1]];
}
