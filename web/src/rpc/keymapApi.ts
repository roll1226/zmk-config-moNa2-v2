import { call_rpc, type RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import type { Keymap, Layer, BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { GetBehaviorDetailsResponse, ListAllBehaviorsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";

export type { Keymap, Layer, BehaviorBinding, GetBehaviorDetailsResponse };

export async function requestUnlock(conn: RpcConnection): Promise<void> {
  await call_rpc(conn, { core: { lock: false } });
}

export async function getKeymap(conn: RpcConnection): Promise<Keymap | undefined> {
  const resp = await call_rpc(conn, { keymap: { getKeymap: true } });
  const km = resp?.keymap?.getKeymap;
  console.log("[getKeymap] layers:", km?.layers?.length, "| layer[0] bindings:", km?.layers?.[0]?.bindings?.length);
  return km;
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
): Promise<void> {
  const resp = await call_rpc(conn, {
    keymap: { setLayerBinding: { layerId, keyPosition, binding } },
  });
  const result = resp?.keymap?.setLayerBinding;
  // 0 = SET_LAYER_BINDING_RESP_OK; non-zero means error
  if (result != null && result !== 0) {
    throw new Error(
      result === 1 ? "無効なキー位置" :
      result === 2 ? "無効なビヘイビア (firmware が拒否)" :
      result === 3 ? "無効なパラメータ (firmware が拒否)" :
      `setLayerBinding エラー (code: ${result})`
    );
  }
}

export async function saveChanges(conn: RpcConnection): Promise<void> {
  const resp = await call_rpc(conn, { keymap: { saveChanges: true } });
  const result = resp?.keymap?.saveChanges;
  if (result?.err != null && result.err !== 0) {
    throw new Error(
      result.err === 2 ? "保存がサポートされていません" :
      result.err === 3 ? "Flash の空き容量が不足しています" :
      `保存エラー (code: ${result.err})`
    );
  }
}

export async function discardChanges(conn: RpcConnection) {
  return call_rpc(conn, { keymap: { discardChanges: true } });
}

export async function checkUnsavedChanges(conn: RpcConnection): Promise<boolean> {
  const resp = await call_rpc(conn, { keymap: { checkUnsavedChanges: true } });
  return resp?.keymap?.checkUnsavedChanges ?? false;
}
