export interface LayoutKey {
  row: number;
  col: number;
  x: number;
  y: number;
}

export interface KeyboardLayout {
  id: string;
  name: string;
  keys: LayoutKey[];
}

export interface ParsedLayer {
  id: string;
  bindings: string[];
  sensorBindings: string;
}

export interface ParsedCombo {
  id: string;
  binding: string;
  keyPositions: number[];
}

export interface ParsedMacro {
  id: string;
  bindings: string[];
}

export interface Mona2Data {
  layout: KeyboardLayout;
  layers: ParsedLayer[];
  combos: ParsedCombo[];
  macros: ParsedMacro[];
}

export interface BluetoothSupport {
  available: boolean;
  message: string;
}

export interface EditableBinding {
  raw: string;
  modified: boolean;
}

export interface EditableLayer {
  id: string;
  sensorBindings: string;
  bindings: EditableBinding[];
  modified: boolean;
}

export interface EditableCombo {
  id: string;
  binding: EditableBinding;
  keyPositions: number[];
  modified: boolean;
}

export interface EditableMacro {
  id: string;
  bindings: EditableBinding[];
  modified: boolean;
}

export interface EditableKeymapState {
  layout: KeyboardLayout;
  layers: EditableLayer[];
  combos: EditableCombo[];
  macros: EditableMacro[];
  selectedLayerId: string;
  selectedKeyIndex: number;
  selectedComboId: string | null;
  selectedMacroId: string | null;
}

export interface KeymapDraftPayload {
  version: number;
  timestamp: number;
  deviceId: string;
  layers: Array<{ id: string; sensorBindings: string; bindings: string[] }>;
  combos: Array<{ id: string; binding: string; keyPositions: number[] }>;
  macros: Array<{ id: string; bindings: string[] }>;
  metadata: {
    hash: string;
    modifiedKeys: number;
  };
}

export interface DeviceStatus {
  version: number;
  flags: number;
  lastCommand: number;
  lastResult: number;
  stagedLength: number;
  committedLength: number;
  stagedHash: number;
  committedHash: number;
}
