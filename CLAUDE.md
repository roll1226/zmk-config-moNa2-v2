# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

ZMK firmware configuration for the **mona2** — a custom split keyboard with:
- MCU: Seeeduino XIAO BLE (nRF52840) on both halves
- Trackball: PAW3222 optical sensor (right side, SPI0)
- Encoders: EC11 rotary encoder (left side)
- RGB LED: Battery level + layer indicator (via rgbled_adapter)
- 43 keys total, 4 layers, BLE split

The repo also contains a **Web Bluetooth keymap editor** (`web/`) that is a work-in-progress.

## Build (GitHub Actions)

Builds are triggered via GitHub Actions (`.github/workflows/build.yml`) using ZMK's standard `build-user-config.yml`. The `build.yaml` matrix defines three artifacts:

| Artifact | Board | Shield | Notes |
|---|---|---|---|
| Right side | `seeeduino_xiao_ble` | `mona2_r` + `rgbled_adapter` | Central, trackball, USB logging |
| Left side | `seeeduino_xiao_ble` | `mona2_l` + `rgbled_adapter` | Peripheral, encoder |
| Reset | `seeeduino_xiao_ble` | `settings_reset` | Clears stored BT bonds |

Flash by dragging the `.uf2` artifact onto the XIAO BLE bootloader volume.

## Web Editor (web/)

```bash
cd web
npm install
npm run dev      # Vite dev server
npm run build    # Production build (runs tsc + vite build)
npm run preview  # Preview production build
```

The web app renders the keyboard layout and layers from `config/mona2.json` and `config/mona2.keymap`. Web Bluetooth connection targets service UUID `12ab0001-8b1f-4f9f-9f64-0fd8b7f56d01`. The GATT characteristic write path is a placeholder — actual BLE keymap update is not yet implemented.

## Architecture

### Zephyr Module (`CMakeLists.txt`, `Kconfig`, `src/`)

The repo registers itself as a Zephyr module via `zephyr/module.yml`. `Kconfig` exposes `CONFIG_MONA2_BLE_KEYMAP_SERVICE` which gates compilation of `src/ble_keymap_service.c`. This file is currently a SYS_INIT stub that logs startup; GATT characteristic + NVS storage are planned for the next phase.

### Shield Definition (`boards/shields/mona2/`)

- `mona2.dtsi` — shared base: physical layout, matrix transform (11 cols × 4 rows), sensors
- `mona2_l.overlay` — left peripheral: encoder on GPIO
- `mona2_r.overlay` — right central: PAW3222 trackball on SPI0, input processors for axis inversion and scroll
- `mona2.keymap` — default keymap (4 layers, combos, macros)
- `mona2.zmk.yml` — shield metadata (requires `seeeduino_xiao_ble`)

### Config (`config/`)

- `mona2_r.conf` — right-side runtime config: encoder, battery reporting, RGB thresholds (critical 10% / high 30%), ZMK Studio enabled, BLE interval 6–12 ms, `CONFIG_MONA2_BLE_KEYMAP_SERVICE=y`
- `mona2_l.conf` — left-side config: encoder + battery only
- `mona2.json` — physical key coordinates used by the web editor
- `mona2.keymap` — keymap source also parsed by the web editor
- `west.yml` — ZMK dependency manifest pinning ZMK v0.2.1 plus external modules:
  - `sekigon-gonnoc/zmk-driver-paw3222` (trackball driver)
  - `caksoylar/zmk-rgbled-widget` (RGB LED widget)
  - `zettaface/zmk-input-processor-keybind` (input processor)

### Trackball Input Processing

PAW3222 input goes through ZMK input processors defined in `mona2_r.overlay`:
- X/Y axis inversion transforms (currently some commented out — see recent commits)
- Scroll mapping for scroller mode
- CPI default: 600

## Key Constraints

- ZMK Studio is enabled without locking (`CONFIG_ZMK_STUDIO_LOCKING=n`) — keymap edits via Studio affect NVS storage.
- The right half is the BLE central; always flash right first when re-pairing.
- `CONFIG_MONA2_BLE_KEYMAP_SERVICE` is only enabled on the right side config.
