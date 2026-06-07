#include "ble_keymap_storage.h"

#include <errno.h>
#include <string.h>

#include <zephyr/settings/settings.h>

#define MONA2_SETTINGS_ROOT "mona2"
#define MONA2_SETTINGS_PAYLOAD_KEY "mona2/keymap/payload"
#define MONA2_SETTINGS_HASH_KEY "mona2/keymap/hash"

static struct mona2_ble_keymap_blob committed_blob;

static uint32_t mona2_ble_keymap_fnv1a(const uint8_t *payload, size_t length)
{
    uint32_t hash = 2166136261u;

    for (size_t index = 0; index < length; index++) {
        hash ^= payload[index];
        hash *= 16777619u;
    }

    return hash;
}

static int mona2_ble_keymap_settings_set(const char *name, size_t len_rd,
                                         settings_read_cb read_cb, void *cb_arg)
{
    if (strcmp(name, "keymap/payload") == 0) {
        if (len_rd > sizeof(committed_blob.payload)) {
            return -ENOMEM;
        }

        ssize_t read_length = read_cb(cb_arg, committed_blob.payload, len_rd);
        if (read_length < 0) {
            return (int)read_length;
        }

        committed_blob.length = (size_t)read_length;
        committed_blob.available = committed_blob.length > 0U;
        if (committed_blob.available) {
            committed_blob.hash = mona2_ble_keymap_fnv1a(committed_blob.payload,
                                                         committed_blob.length);
        }

        return 0;
    }

    if (strcmp(name, "keymap/hash") == 0) {
        uint32_t stored_hash = 0U;
        ssize_t read_length = read_cb(cb_arg, &stored_hash, sizeof(stored_hash));
        if (read_length < 0) {
            return (int)read_length;
        }

        if ((size_t)read_length == sizeof(stored_hash)) {
            committed_blob.hash = stored_hash;
        }

        return 0;
    }

    return -ENOENT;
}

static int mona2_ble_keymap_settings_commit(void)
{
    if (committed_blob.available && committed_blob.hash == 0U) {
        committed_blob.hash = mona2_ble_keymap_fnv1a(committed_blob.payload,
                                                     committed_blob.length);
    }

    return 0;
}

static struct settings_handler mona2_ble_keymap_settings = {
    .name = MONA2_SETTINGS_ROOT,
    .h_set = mona2_ble_keymap_settings_set,
    .h_commit = mona2_ble_keymap_settings_commit,
};

int mona2_ble_keymap_storage_init(void)
{
    int ret = settings_subsys_init();
    if (ret < 0 && ret != -EALREADY) {
        return ret;
    }

    ret = settings_register(&mona2_ble_keymap_settings);
    if (ret < 0 && ret != -EEXIST) {
        return ret;
    }

    ret = settings_load_subtree(MONA2_SETTINGS_ROOT);
    if (ret < 0) {
        return ret;
    }

    if (committed_blob.available && committed_blob.hash == 0U) {
        committed_blob.hash = mona2_ble_keymap_fnv1a(committed_blob.payload,
                                                     committed_blob.length);
    }

    return 0;
}

const struct mona2_ble_keymap_blob *mona2_ble_keymap_storage_get(void)
{
    return &committed_blob;
}

int mona2_ble_keymap_storage_save(const uint8_t *payload, size_t length, uint32_t hash)
{
    if (length > sizeof(committed_blob.payload)) {
        return -ENOMEM;
    }

    int ret = settings_save_one(MONA2_SETTINGS_PAYLOAD_KEY, payload, length);
    if (ret < 0) {
        return ret;
    }

    uint32_t persisted_hash = hash != 0U ? hash : mona2_ble_keymap_fnv1a(payload, length);
    ret = settings_save_one(MONA2_SETTINGS_HASH_KEY, &persisted_hash, sizeof(persisted_hash));
    if (ret < 0) {
        return ret;
    }

    memcpy(committed_blob.payload, payload, length);
    committed_blob.length = length;
    committed_blob.hash = persisted_hash;
    committed_blob.available = length > 0U;

    return 0;
}

int mona2_ble_keymap_storage_clear(void)
{
    int ret = settings_delete(MONA2_SETTINGS_PAYLOAD_KEY);
    if (ret < 0) {
        return ret;
    }

    ret = settings_delete(MONA2_SETTINGS_HASH_KEY);
    if (ret < 0) {
        return ret;
    }

    memset(&committed_blob, 0, sizeof(committed_blob));
    return 0;
}
