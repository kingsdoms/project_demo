export const isStr = (v) => typeof v === "string" && v.length > 0;
export const isInt = (v) => Number.isInteger(v);
export const hasKey = (obj, key) => obj != null && Object.hasOwn(obj, key);
