export interface KeyPosition {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
}

// 42 keys from config/mona2.json
// row/col → sequential key index (matches keymap bindings order)
export const MONA2_KEYS: KeyPosition[] = [
  // Row 1 (y=1): 10 keys — cols 0-4 (left), 8-12 (right)
  { x: 0, y: 1 }, // 0  Q
  { x: 1, y: 1 }, // 1  W
  { x: 2, y: 1 }, // 2  E
  { x: 3, y: 1 }, // 3  R
  { x: 4, y: 1 }, // 4  T
  { x: 8, y: 1 }, // 5  Y
  { x: 9, y: 1 }, // 6  U
  { x: 10, y: 1 }, // 7  I
  { x: 11, y: 1 }, // 8  O
  { x: 12, y: 1 }, // 9  P

  // Row 2 (y=2): 11 keys — cols 0-4 (left), 7-12 (right)
  { x: 0, y: 2 }, // 10  A
  { x: 1, y: 2 }, // 11  S
  { x: 2, y: 2 }, // 12  D
  { x: 3, y: 2 }, // 13  F
  { x: 4, y: 2 }, // 14  G
  { x: 7, y: 2 }, // 15  (none placeholder in keymap)
  { x: 8, y: 2 }, // 16  H
  { x: 9, y: 2 }, // 17  J
  { x: 10, y: 2 }, // 18  K
  { x: 11, y: 2 }, // 19  L
  { x: 12, y: 2 }, // 20  ;

  // Row 3 (y=3): 12 keys — cols 0-5 (left), 7-12 (right)
  { x: 0, y: 3 }, // 21  Z
  { x: 1, y: 3 }, // 22  X
  { x: 2, y: 3 }, // 23  C
  { x: 3, y: 3 }, // 24  V
  { x: 4, y: 3 }, // 25  B
  { x: 5, y: 3 }, // 26  RCTRL
  { x: 7, y: 3 }, // 27  (none)
  { x: 8, y: 3 }, // 28  N
  { x: 9, y: 3 }, // 29  M
  { x: 10, y: 3 }, // 30  ,
  { x: 11, y: 3 }, // 31  .
  { x: 12, y: 3 }, // 32  /

  // Row 4 / thumb (y=4): 9 keys
  { x: 0, y: 4 }, // 33  L_SHIFT
  { x: 1, y: 4 }, // 34  RCLK
  { x: 2, y: 4 }, // 35  LCLK
  { x: 3, y: 4 }, // 36  LCMD
  { x: 4, y: 4 }, // 37  Layer1/LANG2
  { x: 5, y: 4 }, // 38  Layer3/SPACE
  { x: 7, y: 4 }, // 39  ENTER
  { x: 8, y: 4 }, // 40  Layer2/LANG1
  { x: 12, y: 4 }, // 41  L_ALT
];

export const UNIT_PX = 52;
export const KEY_SIZE_PX = 48;
export const BOARD_WIDTH_PX = (12 + 1) * UNIT_PX;
export const BOARD_HEIGHT_PX = (4 + 1) * UNIT_PX;

export const LAYER_NAMES = [
  "Default",
  "Layer 1",
  "Layer 2",
  "Layer 3",
  "Layer 4",
  "MOUSE",
  "SCROLL",
];
