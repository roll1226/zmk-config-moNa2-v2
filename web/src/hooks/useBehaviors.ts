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

  useEffect(() => {
    if (!conn) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const ids = await listAllBehaviors(conn);
        const map = new Map<number, BehaviorDetails>();
        for (const id of ids) {
          if (cancelled) return;
          const details = await getBehaviorDetails(conn, id);
          if (details) map.set(id, details);
        }
        if (!cancelled) setBehaviors(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conn]);

  return { behaviors, loading };
}
