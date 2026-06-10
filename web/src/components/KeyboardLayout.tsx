import { MONA2_KEYS, BOARD_WIDTH_PX, BOARD_HEIGHT_PX, UNIT_PX } from "../layout/mona2-layout";
import type { KeyBinding } from "../hooks/useKeymap";
import type { BehaviorDetails } from "../hooks/useBehaviors";
import { KeyCap } from "./KeyCap";

interface KeyboardLayoutProps {
  bindings: KeyBinding[];
  behaviors: Map<number, BehaviorDetails>;
  selectedKey: number | null;
  onKeyClick: (index: number) => void;
}

export function KeyboardLayout({
  bindings,
  behaviors,
  selectedKey,
  onKeyClick,
}: KeyboardLayoutProps) {
  return (
    <div
      className="relative"
      style={{ width: BOARD_WIDTH_PX, height: BOARD_HEIGHT_PX + UNIT_PX }}
    >
      {MONA2_KEYS.map((keyPos, i) => (
        <KeyCap
          key={i}
          keyPos={keyPos}
          binding={bindings[i]}
          behaviors={behaviors}
          selected={selectedKey === i}
          onClick={() => onKeyClick(i)}
        />
      ))}
    </div>
  );
}
