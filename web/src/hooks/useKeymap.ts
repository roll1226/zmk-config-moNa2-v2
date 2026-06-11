import { useState, useEffect, useCallback } from "react";
import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import { MetaError } from "@zmkfirmware/zmk-studio-ts-client";
import type { BehaviorBinding, Layer } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import {
  getKeymap,
  requestUnlock,
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
      // Try to unlock; RPC_NOT_FOUND (code 2) means LOCKING=n — safe to ignore.
      await requestUnlock(conn).catch((e: unknown) => {
        if (e instanceof MetaError && e.condition === 2) return;
        throw e;
      });
      const resp = await getKeymap(conn);
      if (!resp) {
        setError("キーマップの取得に失敗しました");
        return;
      }
      setLayers(resp.layers);
      setUnsaved(false);
    } catch (e) {
      setError(`接続エラー: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [conn]);

  useEffect(() => {
    void fetchKeymap();
  }, [fetchKeymap]);

  const updateBinding = useCallback(
    async (layerId: number, keyPosition: number, binding: KeyBinding): Promise<boolean> => {
      if (!conn) return false;
      try {
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
        return true;
      } catch (e) {
        setError(`キーの更新に失敗しました: ${String(e)}`);
        return false;
      }
    },
    [conn]
  );

  const save = useCallback(async () => {
    if (!conn) return;
    try {
      await saveChanges(conn);
      setUnsaved(false);
    } catch (e) {
      setError(`保存に失敗しました: ${String(e)}`);
    }
  }, [conn]);

  const discard = useCallback(async () => {
    if (!conn) return;
    try {
      await discardChanges(conn);
      await fetchKeymap();
    } catch (e) {
      setError(`破棄に失敗しました: ${String(e)}`);
    }
  }, [conn, fetchKeymap]);

  // Consume notification_readable to prevent stream backpressure from blocking RPC responses.
  // ZMK sends a lockStateChanged notification on connect; if unread, it stalls the tee'd stream
  // and all subsequent RPC calls hang.
  useEffect(() => {
    if (!conn) return;

    const reader = conn.notification_readable.getReader();
    let active = true;

    void (async () => {
      try {
        while (active) {
          const { done, value } = await reader.read();
          if (done || !active) break;
          if (value?.keymap?.unsavedChangesStatusChanged !== undefined) {
            setUnsaved(value.keymap.unsavedChangesStatusChanged);
          }
        }
      } catch {
        // transport closed
      } finally {
        reader.releaseLock();
      }
    })();

    return () => {
      active = false;
      reader.cancel().catch(() => {});
    };
  }, [conn]);

  return { layers, loading, error, unsaved, updateBinding, save, discard };
}
