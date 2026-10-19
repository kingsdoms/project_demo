/**
 * @file Game.js
 * @author tuanca
 */
//buildRules: ghép luật gốc với extension


import { RuleSet } from '../models/RuleSet.js';
export function compose(...ruleSets) {
  const merged = new RuleSet();
  ruleSets.forEach((set, index) => {
    for (const [key, rule] of set.entries()) {
      try {
        merged.add(key, rule);
      } catch {
        throw new Error(`compose: rule "${key}" bị trùng (bộ thứ ${index + 1})`);
      }
    }
  });
  return merged;
}