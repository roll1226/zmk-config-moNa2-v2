COROPITを使用する方は以下のようにコードを編集してください。

mona2_r.overlay

修正前
```
  trackball_central: trackball_central@0 {
        status = "okay";
        compatible = "pixart,pmw3610";  //トラボセンサ用のドライバとバインド
        reg = <0>;
        spi-max-frequency = <2000000>;
        irq-gpios = <&gpio0 2 (GPIO_ACTIVE_LOW | GPIO_PULL_UP)>; //P0.02を指定(MOTION)
        cpi = <600>;
        //swap-xy;
        //invert-x; //COROPIT版ではコメントアウトを外す
        //invert-y; //COROPIT版ではコメントアウトを外す
        evt-type = <INPUT_EV_REL>;
        x-input-code = <INPUT_REL_X>;
        y-input-code = <INPUT_REL_Y>;
    };
};

```

## mona2 BLE keymap editor implementation status

このリポジトリには、mona2 の現行 keymap を可視化する Web アプリの初期実装を追加しています。

### Web app

web ディレクトリで以下を実行すると、現在の mona2 レイアウトと layers、combos、macros をブラウザ上で確認できます。

```sh
cd web
npm install
npm run dev
```

本番ビルド確認は以下です。

```sh
cd web
npm run build
```

現時点では BLE 接続ボタンは将来の GATT サービス用プレースホルダーです。Chrome 系ブラウザでのみ Web Bluetooth の可否を確認でき、キーマップの書き込みはまだ未実装です。

### Firmware scaffold

右手側には mona2 専用の BLE keymap service を載せるための Zephyr module の足場を追加しています。

- Kconfig: mona2 extensions
- C source: src/ble_keymap_service.c
- right side config: config/mona2_r.conf

現時点のファーム実装は初期化プレースホルダーのみで、GATT characteristic や NVS 保存は次段階で実装します。
**修正後**
```
  trackball_central: trackball_central@0 {
        status = "okay";
        compatible = "pixart,pmw3610";  //トラボセンサ用のドライバとバインド
        reg = <0>;
        spi-max-frequency = <2000000>;
        irq-gpios = <&gpio0 2 (GPIO_ACTIVE_LOW | GPIO_PULL_UP)>; //P0.02を指定(MOTION)
        cpi = <600>;
        //swap-xy;
        invert-x; //COROPIT版ではコメントアウトを外す
        invert-y; //COROPIT版ではコメントアウトを外す
        evt-type = <INPUT_EV_REL>;
        x-input-code = <INPUT_REL_X>;
        y-input-code = <INPUT_REL_Y>;
    };
};

```
