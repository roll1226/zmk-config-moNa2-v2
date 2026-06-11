import { useRef, useState } from "react";
import { MONA2_KEYS, BOARD_WIDTH_PX, BOARD_HEIGHT_PX, UNIT_PX } from "../layout/mona2-layout";
import type { KeyBinding } from "../hooks/useKeymap";
import type { BehaviorDetails } from "../hooks/useBehaviors";
import { KeyCap } from "./KeyCap";
import { PICKER_DRAG_TYPE } from "./KeyPickerPanel";

interface KeyboardLayoutProps {
  bindings: KeyBinding[];
  behaviors: Map<number, BehaviorDetails>;
  selectedKey: number | null;
  onKeyClick: (index: number) => void;
  onSwap: (fromIndex: number, toIndex: number) => void;
  onAssignFromPicker: (keyIndex: number, rawCode: number, mods: number) => void;
}

export function KeyboardLayout({
  bindings,
  behaviors,
  selectedKey,
  onKeyClick,
  onSwap,
  onAssignFromPicker,
}: KeyboardLayoutProps) {
  const dragSourceRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
          isDragOver={dragOverIndex === i && dragSourceRef.current !== i}
          onClick={() => onKeyClick(i)}
          onDragStart={(e) => {
            dragSourceRef.current = i;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(i));
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragOverIndex !== i) setDragOverIndex(i);
          }}
          onDragLeave={() => setDragOverIndex(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverIndex(null);
            // Picker key dropped onto keyboard
            const pickerData = e.dataTransfer.getData(PICKER_DRAG_TYPE);
            if (pickerData) {
              try {
                const { rawCode, mods } = JSON.parse(pickerData) as { rawCode: number; mods: number };
                onAssignFromPicker(i, rawCode, mods);
              } catch { /* ignore bad drag data */ }
              dragSourceRef.current = null;
              return;
            }
            // Keycap-to-keycap swap
            const src = dragSourceRef.current;
            dragSourceRef.current = null;
            if (src !== null && src !== i) onSwap(src, i);
          }}
          onDragEnd={() => {
            dragSourceRef.current = null;
            setDragOverIndex(null);
          }}
        />
      ))}
    </div>
  );
}
