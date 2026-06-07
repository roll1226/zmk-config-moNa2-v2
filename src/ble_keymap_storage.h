#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

struct mona2_ble_keymap_blob {
    uint8_t payload[CONFIG_MONA2_BLE_KEYMAP_MAX_PAYLOAD_SIZE];
    size_t length;
    uint32_t hash;
    bool available;
};

int mona2_ble_keymap_storage_init(void);
const struct mona2_ble_keymap_blob *mona2_ble_keymap_storage_get(void);
int mona2_ble_keymap_storage_save(const uint8_t *payload, size_t length, uint32_t hash);
int mona2_ble_keymap_storage_clear(void);
