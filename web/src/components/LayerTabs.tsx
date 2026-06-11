import { LAYER_NAMES } from "../layout/mona2-layout";

interface LayerTabsProps {
  layerCount: number;
  activeLayer: number;
  layerNames: string[];
  onChange: (index: number) => void;
}

export function LayerTabs({
  layerCount,
  activeLayer,
  layerNames,
  onChange,
}: LayerTabsProps) {
  const count = layerCount || LAYER_NAMES.length;
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            activeLayer === i
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          {layerNames[i] ?? LAYER_NAMES[i] ?? `Layer ${i}`}
        </button>
      ))}
    </div>
  );
}
