import type { KeyBinding } from "../hooks/useKeymap";
import type { BehaviorDetails } from "../hooks/useBehaviors";
import { KEY_SIZE_PX, UNIT_PX, type KeyPosition } from "../layout/mona2-layout";
import { getKeyLabel } from "../utils/keyLabel";

interface KeyCapProps {
  keyPos: KeyPosition;
  binding: KeyBinding | undefined;
  behaviors: Map<number, BehaviorDetails>;
  selected: boolean;
  onClick: () => void;
}

export function KeyCap({
  keyPos,
  binding,
  behaviors,
  selected,
  onClick,
}: KeyCapProps) {
  const behavior = binding ? behaviors.get(binding.behaviorId) : undefined;
  const label = binding ? getKeyLabel(binding, behaviors) : "";
  const behaviorName = behavior?.displayName ?? "";

  return (
    <button
      onClick={onClick}
      style={{
        position: "absolute",
        left: keyPos.x * UNIT_PX,
        top: keyPos.y * UNIT_PX,
        width: KEY_SIZE_PX,
        height: KEY_SIZE_PX,
      }}
      className={`rounded flex flex-col items-center justify-center text-xs leading-tight border transition-all ${
        selected
          ? "bg-blue-600 border-blue-400 text-white"
          : "bg-gray-700 border-gray-500 text-gray-200 hover:bg-gray-600 hover:border-gray-400"
      }`}
      title={behaviorName}
    >
      <span className="font-medium truncate w-full text-center px-1">
        {label}
      </span>
      {behaviorName && behaviorName !== "Key Press" && (
        <span className="text-[9px] opacity-60 truncate w-full text-center px-1">
          {behaviorName}
        </span>
      )}
    </button>
  );
}
