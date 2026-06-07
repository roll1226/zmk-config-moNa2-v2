import { BleTransport } from "./lib/bleTransport";
import {
  buildDraftPayload,
  encodeDraftPayload,
} from "./lib/keymapPayloadCodec";
import { KeymapStore } from "./lib/keymapStore";
import { loadMona2Data } from "./lib/loadMona2Data";
import type {
  DeviceStatus,
  EditableCombo,
  EditableLayer,
  EditableMacro,
} from "./types";

const data = loadMona2Data();
const store = new KeymapStore(data);
const transport = new BleTransport();

let currentRoot: HTMLElement | null = null;
let message = transport.getSupport().message;
let deviceStatus: DeviceStatus | null = null;

const rerender = () => {
  if (!currentRoot) {
    return;
  }

  currentRoot.innerHTML = renderApp();
  attachAppBehavior(currentRoot);
};

transport.onStatus((status) => {
  deviceStatus = status;
  message = `device status updated: lastResult=${status.lastResult}, staged=${status.stagedLength} bytes`;
  rerender();
});

const getSelectedLayer = (): EditableLayer | undefined => {
  return store.getSelectedLayer() ?? store.getState().layers[0];
};

const getSelectedCombo = (): EditableCombo | undefined => {
  return store.getSelectedCombo();
};

const getSelectedMacro = (): EditableMacro | undefined => {
  return store.getSelectedMacro();
};

const renderLayerButtons = (selectedLayerId: string) => {
  return store
    .getState()
    .layers.map(
      (layer) => `
        <button class="layer-button${layer.id === selectedLayerId ? " is-active" : ""}" data-layer-id="${layer.id}">
          <span>${layer.id}</span>
          <small>${layer.sensorBindings}</small>
        </button>
      `,
    )
    .join("");
};

const renderKeyGrid = (layer: EditableLayer, selectedKeyIndex: number) => {
  return data.layout.keys
    .map((key, index) => {
      const binding = layer.bindings[index]?.raw ?? "&trans";
      const modified = layer.bindings[index]?.modified ? " is-modified" : "";
      const selected = index === selectedKeyIndex ? " is-selected" : "";

      return `
        <button
          class="keycap${selected}${modified}"
          style="grid-column:${key.x + 1}; grid-row:${key.y};"
          data-key-index="${index}"
          title="row ${key.row} / col ${key.col}"
        >
          <span class="keycap-index">${index}</span>
          <span class="keycap-binding">${binding}</span>
        </button>
      `;
    })
    .join("");
};

const renderComboList = (selectedComboId: string | null) => {
  return store
    .getState()
    .combos.map(
      (combo) => `
        <button class="detail-chip${combo.id === selectedComboId ? " is-active" : ""}" data-combo-id="${combo.id}">
          <strong>${combo.id}</strong>
          <span>${combo.binding.raw}</span>
        </button>
      `,
    )
    .join("");
};

const renderMacroList = (selectedMacroId: string | null) => {
  return store
    .getState()
    .macros.map(
      (macro) => `
        <button class="detail-chip${macro.id === selectedMacroId ? " is-active" : ""}" data-macro-id="${macro.id}">
          <strong>${macro.id}</strong>
          <span>${macro.bindings.map((binding) => binding.raw).join(" -> ")}</span>
        </button>
      `,
    )
    .join("");
};

const renderDeviceStatus = () => {
  if (!deviceStatus) {
    return '<p class="support-message">device status は未取得です。</p>';
  }

  return `
    <dl class="status-grid">
      <div><dt>staged</dt><dd>${deviceStatus.stagedLength}</dd></div>
      <div><dt>committed</dt><dd>${deviceStatus.committedLength}</dd></div>
      <div><dt>flags</dt><dd>${deviceStatus.flags}</dd></div>
      <div><dt>result</dt><dd>${deviceStatus.lastResult}</dd></div>
    </dl>
  `;
};

const renderSidebar = () => {
  const state = store.getState();
  const selectedBinding = store.getSelectedBinding();
  const selectedCombo = getSelectedCombo();
  const selectedMacro = getSelectedMacro();
  const draftPayload = buildDraftPayload(state);

  return `
    <aside class="sidebar-panel stack-panel">
      <div class="panel-heading">
        <p class="eyebrow">Draft State</p>
        <h2>Editor controls</h2>
        <p class="support-message">${message}</p>
      </div>

      <section class="editor-card">
        <h3>Selected key</h3>
        <p class="detail-meta">layer ${state.selectedLayerId} / key ${state.selectedKeyIndex}</p>
        <form id="binding-form" class="editor-form">
          <label class="field-label" for="binding-input">Binding</label>
          <input id="binding-input" name="binding" class="text-field" value="${selectedBinding?.raw ?? "&trans"}" />
          <div class="button-row">
            <button class="secondary-button" type="submit">Apply key binding</button>
          </div>
        </form>
      </section>

      <section class="editor-card">
        <h3>Combos</h3>
        <div class="chip-list">${renderComboList(state.selectedComboId)}</div>
        ${
          selectedCombo
            ? `
          <form id="combo-form" class="editor-form">
            <label class="field-label" for="combo-binding-input">Binding</label>
            <input id="combo-binding-input" class="text-field" value="${selectedCombo.binding.raw}" />
            <label class="field-label" for="combo-positions-input">Key positions</label>
            <input id="combo-positions-input" class="text-field" value="${selectedCombo.keyPositions.join(", ")}" />
            <div class="button-row">
              <button class="secondary-button" type="submit">Apply combo</button>
            </div>
          </form>
        `
            : '<p class="detail-meta">No combo selected.</p>'
        }
      </section>

      <section class="editor-card">
        <h3>Macros</h3>
        <div class="chip-list">${renderMacroList(state.selectedMacroId)}</div>
        ${
          selectedMacro
            ? `
          <form id="macro-form" class="editor-form">
            <label class="field-label" for="macro-bindings-input">Bindings (one per line)</label>
            <textarea id="macro-bindings-input" class="text-area">${selectedMacro.bindings.map((binding) => binding.raw).join("\n")}</textarea>
            <div class="button-row">
              <button class="secondary-button" type="submit">Apply macro</button>
            </div>
          </form>
        `
            : '<p class="detail-meta">No macro selected.</p>'
        }
      </section>

      <section class="editor-card">
        <h3>BLE actions</h3>
        <div class="button-row wrap-row">
          <button class="primary-button" id="connect-button" ${transport.getSupport().available ? "" : "disabled"}>
            ${transport.isConnected() ? `Connected: ${transport.getConnectedDeviceName() ?? "device"}` : "BLE 接続"}
          </button>
          <button class="secondary-button" id="push-draft-button">Push draft</button>
          <button class="secondary-button" id="commit-button">Commit</button>
          <button class="secondary-button" id="rollback-device-button">Device rollback</button>
          <button class="secondary-button" id="clear-device-button">Clear device</button>
          <button class="secondary-button" id="rollback-local-button">Local rollback</button>
        </div>
        ${renderDeviceStatus()}
      </section>

      <section class="editor-card">
        <h3>Payload preview</h3>
        <p class="detail-meta">modified entries: ${store.getModifiedCount()}</p>
        <pre class="payload-preview">${JSON.stringify(draftPayload, null, 2)}</pre>
      </section>
    </aside>
  `;
};

export const renderApp = () => {
  const state = store.getState();
  const selectedLayer = getSelectedLayer();

  if (!selectedLayer) {
    return `<div class="shell"><p style="padding:32px">keymap の解析に失敗しました。ブラウザコンソールを確認してください。</p></div>`;
  }

  return `
    <div class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">BLE keymap workbench</p>
          <h1>mona2 keymap editor</h1>
          <p class="hero-copy">
            keycap、combo、macro を編集し、そのまま BLE GATT payload に変換して draft/commit できます。
          </p>
        </div>
        <div class="hero-actions">
          <div class="hero-pill">keys ${data.layout.keys.length}</div>
          <div class="hero-pill">layers ${state.layers.length}</div>
          <div class="hero-pill">dirty ${store.getModifiedCount()}</div>
        </div>
      </header>

      <main class="workspace">
        <section class="editor-panel">
          <div class="panel-heading">
            <p class="eyebrow">Layers</p>
            <h2>Physical layout</h2>
          </div>
          <div class="layer-buttons">
            ${renderLayerButtons(state.selectedLayerId)}
          </div>
          <div class="keyboard-grid" id="keyboard-grid">
            ${renderKeyGrid(selectedLayer, state.selectedKeyIndex)}
          </div>
        </section>

        ${renderSidebar()}
      </main>
    </div>
  `;
};

export const attachAppBehavior = (root: HTMLElement) => {
  currentRoot = root;

  root
    .querySelectorAll<HTMLButtonElement>(".layer-button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const layerId = button.dataset.layerId;
        if (!layerId) {
          return;
        }

        store.selectLayer(layerId);
        rerender();
      });
    });

  root.querySelectorAll<HTMLButtonElement>(".keycap").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.keyIndex);
      if (!Number.isFinite(index)) {
        return;
      }

      store.selectKey(index);
      rerender();
    });
  });

  root
    .querySelectorAll<HTMLButtonElement>("[data-combo-id]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const comboId = button.dataset.comboId;
        if (!comboId) {
          return;
        }

        store.selectCombo(comboId);
        rerender();
      });
    });

  root
    .querySelectorAll<HTMLButtonElement>("[data-macro-id]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const macroId = button.dataset.macroId;
        if (!macroId) {
          return;
        }

        store.selectMacro(macroId);
        rerender();
      });
    });

  root
    .querySelector<HTMLFormElement>("#binding-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = root.querySelector<HTMLInputElement>("#binding-input");
      const nextBinding = input?.value ?? "";
      const error = store.validateBinding(nextBinding);

      if (error) {
        window.alert(error);
        return;
      }

      store.updateSelectedBinding(nextBinding);
      message = `updated key ${store.getState().selectedKeyIndex} on ${store.getState().selectedLayerId}`;
      rerender();
    });

  root
    .querySelector<HTMLFormElement>("#combo-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const binding =
        root.querySelector<HTMLInputElement>("#combo-binding-input")?.value ??
        "";
      const positionsRaw =
        root.querySelector<HTMLInputElement>("#combo-positions-input")?.value ??
        "";
      const error = store.validateBinding(binding);
      if (error) {
        window.alert(error);
        return;
      }

      const positions = positionsRaw
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value));
      store.updateSelectedCombo(binding, positions);
      message = `updated combo ${store.getState().selectedComboId ?? ""}`;
      rerender();
    });

  root
    .querySelector<HTMLFormElement>("#macro-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const bindings =
        root.querySelector<HTMLTextAreaElement>("#macro-bindings-input")
          ?.value ?? "";
      const lines = bindings
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const invalid = lines.find((line) => store.validateBinding(line));
      if (invalid) {
        window.alert(`invalid macro binding: ${invalid}`);
        return;
      }

      store.updateSelectedMacro(lines);
      message = `updated macro ${store.getState().selectedMacroId ?? ""}`;
      rerender();
    });

  root
    .querySelector<HTMLButtonElement>("#rollback-local-button")
    ?.addEventListener("click", () => {
      store.rollbackDraft();
      message = "local draft rolled back";
      rerender();
    });

  root
    .querySelector<HTMLButtonElement>("#connect-button")
    ?.addEventListener("click", async () => {
      try {
        const device = await transport.connect();
        message = `connected to ${device.name ?? "device"}`;
        await transport.readStatus();
        rerender();
      } catch (error) {
        message = error instanceof Error ? error.message : "failed to connect";
        rerender();
      }
    });

  root
    .querySelector<HTMLButtonElement>("#push-draft-button")
    ?.addEventListener("click", async () => {
      try {
        const payload = encodeDraftPayload(store.getState());
        await transport.writeDraftPayload(payload, 128);
        message = `draft pushed (${payload.byteLength} bytes)`;
        await transport.readStatus();
        rerender();
      } catch (error) {
        message =
          error instanceof Error ? error.message : "failed to push draft";
        rerender();
      }
    });

  root
    .querySelector<HTMLButtonElement>("#commit-button")
    ?.addEventListener("click", async () => {
      try {
        await transport.commitDraft();
        message = "commit command sent";
        await transport.readStatus();
        rerender();
      } catch (error) {
        message =
          error instanceof Error ? error.message : "failed to commit draft";
        rerender();
      }
    });

  root
    .querySelector<HTMLButtonElement>("#rollback-device-button")
    ?.addEventListener("click", async () => {
      try {
        await transport.rollbackDraft();
        message = "device rollback command sent";
        await transport.readStatus();
        rerender();
      } catch (error) {
        message =
          error instanceof Error ? error.message : "failed to rollback device";
        rerender();
      }
    });

  root
    .querySelector<HTMLButtonElement>("#clear-device-button")
    ?.addEventListener("click", async () => {
      try {
        await transport.clearCommitted();
        message = "clear command sent";
        await transport.readStatus();
        rerender();
      } catch (error) {
        message =
          error instanceof Error
            ? error.message
            : "failed to clear device payload";
        rerender();
      }
    });
};
