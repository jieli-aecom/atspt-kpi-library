import type { KpiMetric } from './types.js';

export const sameStructuredValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => sameStructuredValue(value, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(rightRecord, key) && sameStructuredValue(leftRecord[key], rightRecord[key])
  );
};


/** All persisted KPI fields are material except the edit timestamp itself. */
export const sameKpiMaterial = (left: KpiMetric, right: KpiMetric): boolean => {
  if (left === right) return true;
  const { lastModified: leftTimestamp, ...leftMaterial } = left;
  const { lastModified: rightTimestamp, ...rightMaterial } = right;
  return sameStructuredValue(leftMaterial, rightMaterial);
};
