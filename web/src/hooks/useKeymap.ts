import { useState, useEffect, useCallback } from "react";
import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import type { BehaviorBinding, Layer } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import {
  getKeymap,
  setLayerBinding,
  saveChanges,
  discardChanges,
} from "../rpc/keymapApi";

export type KeyBinding = BehaviorBinding;
export type KeymapLayer = Layer;

export function useKeymap(conn: RpcConnection | null) {
  const [layers, setLayers] = useState<KeymapLayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);

  const fetchKeymap = useCallback(async () => {
    if (!conn) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await getKeymap(conn);
      if (!resp) {
        setError("キーマップの取得に失敗しました");
        return;
      }
      setLayers(resp.layers);
      setUnsaved(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [conn]);

  useEffect(() => {
    fetchKeymap();
  }, [fetchKeymap]);

  const updateBinding = useCallback(
    async (layerId: number, keyPosition: number, binding: KeyBinding) => {
      if (!conn) return;
      await setLayerBinding(conn, layerId, keyPosition, binding);
      setLayers((prev: KeymapLayer[]) =>
        prev.map((layer: KeymapLayer) => {
          if (layer.id !== layerId) return layer;
          const newBindings = [...layer.bindings];
          newBindings[keyPosition] = binding;
          return { ...layer, bindings: newBindings };
        })
      );
      setUnsaved(true);
    },
    [conn]
  );

  const save = useCallback(async () => {
    if (!conn) return;
    await saveChanges(conn);
    setUnsaved(false);
  }, [conn]);

  const discard = useCallback(async () => {
    if (!conn) return;
    await discardChanges(conn);
    await fetchKeymap();
  }, [conn, fetchKeymap]);

  return { layers, loading, error, unsaved, updateBinding, save, discard };
}
