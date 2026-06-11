import { useState, useEffect } from "react";
import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { getBehaviorDetails, listAllBehaviors } from "../rpc/keymapApi";

export type BehaviorDetails = GetBehaviorDetailsResponse;

export function useBehaviors(conn: RpcConnection | null) {
  const [behaviors, setBehaviors] = useState<Map<number, BehaviorDetails>>(
    new Map()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conn) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const ids = await listAllBehaviors(conn);
        console.log("[useBehaviors] behavior IDs:", ids);

        const map = new Map<number, BehaviorDetails>();
        for (const id of ids) {
          if (cancelled) return;
          const details = await getBehaviorDetails(conn, id);
          if (details) {
            map.set(id, details);
            console.log(`[useBehaviors] behavior ${id}:`, details.displayName);
          }
        }
        if (!cancelled) {
          console.log("[useBehaviors] loaded", map.size, "behaviors");
          setBehaviors(map);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[useBehaviors] error:", e);
          setError(String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conn]);

  return { behaviors, loading, error };
}
