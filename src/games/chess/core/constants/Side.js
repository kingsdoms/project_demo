// @ts-nocheck
/**
 * @file Side.js
 * @author tuanca
 */
export const Side = Object.freeze({
  WHITE: "WHITE",
  BLACK: "BLACK",
});

export const OPPONENT = Object.freeze({
  [Side.WHITE]: Side.BLACK,
  [Side.BLACK]: Side.WHITE,
});

export const SIDE_SIGN = Object.freeze({
  [Side.WHITE]: 1,
  [Side.BLACK]: -1,
});


export function randomSide() {
  return Math.random() < 0.5
    ? Side.WHITE
    : Side.BLACK;
}