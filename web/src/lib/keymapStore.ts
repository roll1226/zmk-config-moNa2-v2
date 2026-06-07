import type {
  EditableBinding,
  EditableCombo,
  EditableKeymapState,
  EditableLayer,
  EditableMacro,
  Mona2Data,
} from "../types";

const cloneBinding = (binding: EditableBinding): EditableBinding => ({
  ...binding,
});
const cloneLayer = (layer: EditableLayer): EditableLayer => ({
  ...layer,
  bindings: layer.bindings.map(cloneBinding),
});
const cloneCombo = (combo: EditableCombo): EditableCombo => ({
  ...combo,
  binding: cloneBinding(combo.binding),
  keyPositions: [...combo.keyPositions],
});
const cloneMacro = (macro: EditableMacro): EditableMacro => ({
  ...macro,
  bindings: macro.bindings.map(cloneBinding),
});

const toEditableBinding = (raw: string): EditableBinding => ({
  raw,
  modified: false,
});

const createInitialState = (data: Mona2Data): EditableKeymapState => ({
  layout: data.layout,
  layers: data.layers.map((layer) => ({
    id: layer.id,
    sensorBindings: layer.sensorBindings,
    modified: false,
    bindings: layer.bindings.map(toEditableBinding),
  })),
  combos: data.combos.map((combo) => ({
    id: combo.id,
    modified: false,
    binding: toEditableBinding(combo.binding),
    keyPositions: [...combo.keyPositions],
  })),
  macros: data.macros.map((macro) => ({
    id: macro.id,
    modified: false,
    bindings: macro.bindings.map(toEditableBinding),
  })),
  selectedLayerId: data.layers[0]?.id ?? "",
  selectedKeyIndex: 0,
  selectedComboId: data.combos[0]?.id ?? null,
  selectedMacroId: data.macros[0]?.id ?? null,
});

export class KeymapStore {
  private readonly initialState: EditableKeymapState;
  private state: EditableKeymapState;

  constructor(data: Mona2Data) {
    this.initialState = createInitialState(data);
    this.state = createInitialState(data);
  }

  getState(): EditableKeymapState {
    return {
      ...this.state,
      layers: this.state.layers.map(cloneLayer),
      combos: this.state.combos.map(cloneCombo),
      macros: this.state.macros.map(cloneMacro),
    };
  }

  selectLayer(layerId: string): void {
    this.state.selectedLayerId = layerId;
  }

  selectKey(index: number): void {
    this.state.selectedKeyIndex = index;
  }

  selectCombo(comboId: string): void {
    this.state.selectedComboId = comboId;
  }

  selectMacro(macroId: string): void {
    this.state.selectedMacroId = macroId;
  }

  getSelectedLayer(): EditableLayer | undefined {
    return this.state.layers.find(
      (layer) => layer.id === this.state.selectedLayerId,
    );
  }

  getSelectedCombo(): EditableCombo | undefined {
    return this.state.combos.find(
      (combo) => combo.id === this.state.selectedComboId,
    );
  }

  getSelectedMacro(): EditableMacro | undefined {
    return this.state.macros.find(
      (macro) => macro.id === this.state.selectedMacroId,
    );
  }

  updateSelectedBinding(raw: string): void {
    const layer = this.getSelectedLayer();
    if (!layer) {
      return;
    }

    const binding = layer.bindings[this.state.selectedKeyIndex];
    if (!binding) {
      return;
    }

    binding.raw = raw.trim() || "&trans";
    binding.modified = true;
    layer.modified = true;
  }

  updateSelectedCombo(bindingRaw: string, positions: number[]): void {
    const combo = this.getSelectedCombo();
    if (!combo) {
      return;
    }

    combo.binding.raw = bindingRaw.trim() || "&trans";
    combo.binding.modified = true;
    combo.keyPositions = [...positions];
    combo.modified = true;
  }

  updateSelectedMacro(bindings: string[]): void {
    const macro = this.getSelectedMacro();
    if (!macro) {
      return;
    }

    macro.bindings = bindings
      .map((binding) => binding.trim())
      .filter(Boolean)
      .map((binding) => ({ raw: binding, modified: true }));
    macro.modified = true;
  }

  rollbackDraft(): void {
    this.state = {
      ...this.initialState,
      layers: this.initialState.layers.map(cloneLayer),
      combos: this.initialState.combos.map(cloneCombo),
      macros: this.initialState.macros.map(cloneMacro),
    };
  }

  getSelectedBinding(): EditableBinding | undefined {
    return this.getSelectedLayer()?.bindings[this.state.selectedKeyIndex];
  }

  validateBinding(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) {
      return "binding を空にはできません。";
    }

    if (!trimmed.startsWith("&")) {
      return "ZMK binding は & から始めてください。";
    }

    return null;
  }

  getModifiedCount(): number {
    const layerChanges = this.state.layers.reduce(
      (count, layer) =>
        count + layer.bindings.filter((binding) => binding.modified).length,
      0,
    );
    const comboChanges = this.state.combos.filter(
      (combo) => combo.modified,
    ).length;
    const macroChanges = this.state.macros.filter(
      (macro) => macro.modified,
    ).length;
    return layerChanges + comboChanges + macroChanges;
  }
}
