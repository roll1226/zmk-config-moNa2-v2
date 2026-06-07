import type {
  DeviceStatus,
  EditableKeymapState,
  KeymapDraftPayload,
} from "../types";

export const MONA2_BLE_PROTOCOL_VERSION = 1;
export const MONA2_BLE_FRAME_OPCODE_DRAFT_WRITE = 1;
export const MONA2_BLE_COMMAND_NOOP = 0;
export const MONA2_BLE_COMMAND_COMMIT = 1;
export const MONA2_BLE_COMMAND_ROLLBACK = 2;
export const MONA2_BLE_COMMAND_CLEAR = 3;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const fnv1a = (source: string) => {
  let hash = 0x811c9dc5;

  for (const char of encoder.encode(source)) {
    hash ^= char;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
};

export const buildDraftPayload = (
  state: EditableKeymapState,
): KeymapDraftPayload => {
  const basePayload = {
    version: MONA2_BLE_PROTOCOL_VERSION,
    timestamp: Date.now(),
    deviceId: state.layout.id,
    layers: state.layers.map((layer) => ({
      id: layer.id,
      sensorBindings: layer.sensorBindings,
      bindings: layer.bindings.map((binding) => binding.raw),
    })),
    combos: state.combos.map((combo) => ({
      id: combo.id,
      binding: combo.binding.raw,
      keyPositions: [...combo.keyPositions],
    })),
    macros: state.macros.map((macro) => ({
      id: macro.id,
      bindings: macro.bindings.map((binding) => binding.raw),
    })),
  };

  return {
    ...basePayload,
    metadata: {
      hash: fnv1a(JSON.stringify(basePayload)),
      modifiedKeys: state.layers.reduce(
        (count, layer) =>
          count + layer.bindings.filter((binding) => binding.modified).length,
        0,
      ),
    },
  };
};

export const encodeDraftPayload = (state: EditableKeymapState): Uint8Array => {
  return encoder.encode(JSON.stringify(buildDraftPayload(state)));
};

export const chunkDraftPayload = (
  payload: Uint8Array,
  chunkSize: number,
): Uint8Array[] => {
  const frames: Uint8Array[] = [];

  for (let offset = 0; offset < payload.length; offset += chunkSize) {
    const chunk = payload.slice(offset, offset + chunkSize);
    const frame = new Uint8Array(8 + chunk.length);
    const view = new DataView(frame.buffer);

    frame[0] = MONA2_BLE_PROTOCOL_VERSION;
    frame[1] = MONA2_BLE_FRAME_OPCODE_DRAFT_WRITE;
    view.setUint16(2, offset, true);
    view.setUint16(4, payload.length, true);
    view.setUint16(6, chunk.length, true);
    frame.set(chunk, 8);
    frames.push(frame);
  }

  return frames;
};

export const decodeDeviceStatus = (view: DataView): DeviceStatus => ({
  version: view.getUint8(0),
  flags: view.getUint8(1),
  lastCommand: view.getUint8(2),
  lastResult: view.getInt8(3),
  stagedLength: view.getUint16(4, true),
  committedLength: view.getUint16(6, true),
  stagedHash: view.getUint32(8, true),
  committedHash: view.getUint32(12, true),
});

export const decodePayloadText = (payload: DataView): string => {
  return decoder.decode(
    payload.buffer.slice(
      payload.byteOffset,
      payload.byteOffset + payload.byteLength,
    ),
  );
};
