import { call_rpc, type RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import type { Keymap, Layer, BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { GetBehaviorDetailsResponse, ListAllBehaviorsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";

export type { Keymap, Layer, BehaviorBinding, GetBehaviorDetailsResponse };

export async function getKeymap(conn: RpcConnection): Promise<Keymap | undefined> {
  const resp = await call_rpc(conn, { keymap: { getKeymap: true } });
  return resp?.keymap?.getKeymap;
}

export async function getPhysicalLayouts(conn: RpcConnection) {
  const resp = await call_rpc(conn, { keymap: { getPhysicalLayouts: true } });
  return resp?.keymap?.getPhysicalLayouts;
}

export async function listAllBehaviors(conn: RpcConnection): Promise<ListAllBehaviorsResponse["behaviors"]> {
  const resp = await call_rpc(conn, { behaviors: { listAllBehaviors: true } });
  return resp?.behaviors?.listAllBehaviors?.behaviors ?? [];
}

export async function getBehaviorDetails(
  conn: RpcConnection,
  behaviorId: number
): Promise<GetBehaviorDetailsResponse | undefined> {
  const resp = await call_rpc(conn, {
    behaviors: { getBehaviorDetails: { behaviorId } },
  });
  return resp?.behaviors?.getBehaviorDetails;
}

export async function setLayerBinding(
  conn: RpcConnection,
  layerId: number,
  keyPosition: number,
  binding: BehaviorBinding
) {
  return call_rpc(conn, {
    keymap: { setLayerBinding: { layerId, keyPosition, binding } },
  });
}

export async function saveChanges(conn: RpcConnection) {
  return call_rpc(conn, { keymap: { saveChanges: true } });
}

export async function discardChanges(conn: RpcConnection) {
  return call_rpc(conn, { keymap: { discardChanges: true } });
}

export async function checkUnsavedChanges(conn: RpcConnection): Promise<boolean> {
  const resp = await call_rpc(conn, { keymap: { checkUnsavedChanges: true } });
  return resp?.keymap?.checkUnsavedChanges ?? false;
}
