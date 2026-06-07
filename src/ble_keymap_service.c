#include "ble_keymap_storage.h"

#include <errno.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/gatt.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/init.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/byteorder.h>
#include <zephyr/sys/util.h>

LOG_MODULE_REGISTER(mona2_ble_keymap_service, LOG_LEVEL_INF);

#define MONA2_BLE_KEYMAP_PROTOCOL_VERSION 1U

#define MONA2_BLE_KEYMAP_STATUS_READY BIT(0)
#define MONA2_BLE_KEYMAP_STATUS_HAS_COMMITTED BIT(1)
#define MONA2_BLE_KEYMAP_STATUS_HAS_STAGED BIT(2)
#define MONA2_BLE_KEYMAP_STATUS_STAGED_DIRTY BIT(3)

#define MONA2_BLE_KEYMAP_FRAME_OPCODE_DRAFT_WRITE 1U

#define MONA2_BLE_KEYMAP_COMMAND_NOOP 0U
#define MONA2_BLE_KEYMAP_COMMAND_COMMIT 1U
#define MONA2_BLE_KEYMAP_COMMAND_ROLLBACK 2U
#define MONA2_BLE_KEYMAP_COMMAND_CLEAR 3U

#define MONA2_BLE_KEYMAP_RESULT_OK 0
#define MONA2_BLE_KEYMAP_RESULT_INVALID_FRAME -1
#define MONA2_BLE_KEYMAP_RESULT_TOO_LARGE -2
#define MONA2_BLE_KEYMAP_RESULT_STORAGE_ERROR -3
#define MONA2_BLE_KEYMAP_RESULT_APPLY_ERROR -4

#define BT_UUID_MONA2_KEYMAP_SERVICE_VAL \
    BT_UUID_128_ENCODE(0x12ab0001, 0x8b1f, 0x4f9f, 0x9f64, 0x0fd8b7f56d01)
#define BT_UUID_MONA2_KEYMAP_STATUS_VAL \
    BT_UUID_128_ENCODE(0x12ab0002, 0x8b1f, 0x4f9f, 0x9f64, 0x0fd8b7f56d01)
#define BT_UUID_MONA2_KEYMAP_PAYLOAD_VAL \
    BT_UUID_128_ENCODE(0x12ab0003, 0x8b1f, 0x4f9f, 0x9f64, 0x0fd8b7f56d01)
#define BT_UUID_MONA2_KEYMAP_COMMAND_VAL \
    BT_UUID_128_ENCODE(0x12ab0004, 0x8b1f, 0x4f9f, 0x9f64, 0x0fd8b7f56d01)

static struct bt_uuid_128 mona2_keymap_service_uuid = BT_UUID_INIT_128(BT_UUID_MONA2_KEYMAP_SERVICE_VAL);
static struct bt_uuid_128 mona2_keymap_status_uuid = BT_UUID_INIT_128(BT_UUID_MONA2_KEYMAP_STATUS_VAL);
static struct bt_uuid_128 mona2_keymap_payload_uuid = BT_UUID_INIT_128(BT_UUID_MONA2_KEYMAP_PAYLOAD_VAL);
static struct bt_uuid_128 mona2_keymap_command_uuid = BT_UUID_INIT_128(BT_UUID_MONA2_KEYMAP_COMMAND_VAL);

struct mona2_ble_keymap_frame_header {
    uint8_t version;
    uint8_t opcode;
    uint16_t offset;
    uint16_t total_length;
    uint16_t chunk_length;
} __packed;

struct mona2_ble_keymap_status {
    uint8_t version;
    uint8_t flags;
    uint8_t last_command;
    int8_t last_result;
    uint16_t staged_length;
    uint16_t committed_length;
    uint32_t staged_hash;
    uint32_t committed_hash;
} __packed;

static struct mona2_ble_keymap_status service_status = {
    .version = MONA2_BLE_KEYMAP_PROTOCOL_VERSION,
    .flags = MONA2_BLE_KEYMAP_STATUS_READY,
};

static uint8_t staged_payload[CONFIG_MONA2_BLE_KEYMAP_MAX_PAYLOAD_SIZE];
static size_t staged_length;
static size_t staged_received;
static uint32_t staged_hash;
static bool staged_valid;
static bool notify_enabled;

static uint32_t mona2_ble_keymap_fnv1a(const uint8_t *payload, size_t length)
{
    uint32_t hash = 2166136261u;

    for (size_t index = 0; index < length; index++) {
        hash ^= payload[index];
        hash *= 16777619u;
    }

    return hash;
}

__attribute__((weak)) int mona2_ble_keymap_service_apply(const uint8_t *payload, size_t length)
{
    ARG_UNUSED(payload);
    ARG_UNUSED(length);

    return -ENOTSUP;
}

static void mona2_ble_keymap_refresh_status(void)
{
    const struct mona2_ble_keymap_blob *committed_blob = mona2_ble_keymap_storage_get();

    service_status.flags = MONA2_BLE_KEYMAP_STATUS_READY;
    service_status.staged_length = (uint16_t)staged_length;
    service_status.staged_hash = staged_hash;
    service_status.committed_length = committed_blob->available ? (uint16_t)committed_blob->length : 0U;
    service_status.committed_hash = committed_blob->available ? committed_blob->hash : 0U;

    if (committed_blob->available) {
        service_status.flags |= MONA2_BLE_KEYMAP_STATUS_HAS_COMMITTED;
    }

    if (staged_valid) {
        service_status.flags |= MONA2_BLE_KEYMAP_STATUS_HAS_STAGED;
        if (staged_hash != service_status.committed_hash ||
            staged_length != service_status.committed_length) {
            service_status.flags |= MONA2_BLE_KEYMAP_STATUS_STAGED_DIRTY;
        }
    }
}

/* Forward-declare the GATT service so mona2_ble_keymap_publish_status() can
 * reference its attrs array before BT_GATT_SERVICE_DEFINE appears below. */
extern const struct bt_gatt_service_static mona2_ble_keymap_service;

static void mona2_ble_keymap_publish_status(void)
{
    mona2_ble_keymap_refresh_status();

    if (notify_enabled) {
        bt_gatt_notify(NULL, &mona2_ble_keymap_service.attrs[2], &service_status,
                       sizeof(service_status));
    }
}

static void mona2_ble_keymap_ccc_changed(const struct bt_gatt_attr *attr, uint16_t value)
{
    ARG_UNUSED(attr);
    notify_enabled = (value == BT_GATT_CCC_NOTIFY);
}

static ssize_t mona2_ble_keymap_status_read(struct bt_conn *conn,
                                            const struct bt_gatt_attr *attr,
                                            void *buf, uint16_t len, uint16_t offset)
{
    mona2_ble_keymap_refresh_status();
    return bt_gatt_attr_read(conn, attr, buf, len, offset, &service_status,
                             sizeof(service_status));
}

static ssize_t mona2_ble_keymap_payload_read(struct bt_conn *conn,
                                             const struct bt_gatt_attr *attr,
                                             void *buf, uint16_t len, uint16_t offset)
{
    ARG_UNUSED(attr);
    const struct mona2_ble_keymap_blob *committed_blob = mona2_ble_keymap_storage_get();

    return bt_gatt_attr_read(conn, attr, buf, len, offset, committed_blob->payload,
                             committed_blob->available ? committed_blob->length : 0U);
}

static ssize_t mona2_ble_keymap_payload_write(struct bt_conn *conn,
                                              const struct bt_gatt_attr *attr,
                                              const void *buf, uint16_t len,
                                              uint16_t offset, uint8_t flags)
{
    ARG_UNUSED(conn);
    ARG_UNUSED(attr);
    ARG_UNUSED(offset);
    ARG_UNUSED(flags);

    if (len < sizeof(struct mona2_ble_keymap_frame_header)) {
        service_status.last_result = MONA2_BLE_KEYMAP_RESULT_INVALID_FRAME;
        mona2_ble_keymap_publish_status();
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
    }

    const uint8_t *payload = buf;
    struct mona2_ble_keymap_frame_header header = {
        .version = payload[0],
        .opcode = payload[1],
        .offset = sys_get_le16(&payload[2]),
        .total_length = sys_get_le16(&payload[4]),
        .chunk_length = sys_get_le16(&payload[6]),
    };

    if (header.version != MONA2_BLE_KEYMAP_PROTOCOL_VERSION ||
        header.opcode != MONA2_BLE_KEYMAP_FRAME_OPCODE_DRAFT_WRITE ||
        header.total_length > sizeof(staged_payload) ||
        header.chunk_length != (len - sizeof(header)) ||
        (size_t)header.offset + header.chunk_length > header.total_length) {
        service_status.last_result =
            header.total_length > sizeof(staged_payload) ? MONA2_BLE_KEYMAP_RESULT_TOO_LARGE
                                                         : MONA2_BLE_KEYMAP_RESULT_INVALID_FRAME;
        mona2_ble_keymap_publish_status();
        return BT_GATT_ERR(BT_ATT_ERR_VALUE_NOT_ALLOWED);
    }

    if (header.offset == 0U) {
        memset(staged_payload, 0, sizeof(staged_payload));
        staged_length = header.total_length;
        staged_received = 0U;
        staged_valid = false;
    }

    if (header.offset != staged_received) {
        service_status.last_result = MONA2_BLE_KEYMAP_RESULT_INVALID_FRAME;
        mona2_ble_keymap_publish_status();
        return BT_GATT_ERR(BT_ATT_ERR_VALUE_NOT_ALLOWED);
    }

    memcpy(&staged_payload[header.offset], payload + sizeof(header), header.chunk_length);
    staged_received += header.chunk_length;

    if (staged_received == staged_length) {
        staged_hash = mona2_ble_keymap_fnv1a(staged_payload, staged_length);
        staged_valid = true;
    }

    service_status.last_command = MONA2_BLE_KEYMAP_FRAME_OPCODE_DRAFT_WRITE;
    service_status.last_result = MONA2_BLE_KEYMAP_RESULT_OK;
    mona2_ble_keymap_publish_status();
    return len;
}

static void mona2_ble_keymap_reset_draft(void)
{
    memset(staged_payload, 0, sizeof(staged_payload));
    staged_length = 0U;
    staged_received = 0U;
    staged_hash = 0U;
    staged_valid = false;
}

static ssize_t mona2_ble_keymap_command_write(struct bt_conn *conn,
                                              const struct bt_gatt_attr *attr,
                                              const void *buf, uint16_t len,
                                              uint16_t offset, uint8_t flags)
{
    ARG_UNUSED(conn);
    ARG_UNUSED(attr);
    ARG_UNUSED(offset);
    ARG_UNUSED(flags);

    if (len < 1U) {
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
    }

    const uint8_t command = ((const uint8_t *)buf)[0];
    const struct mona2_ble_keymap_blob *committed_blob = mona2_ble_keymap_storage_get();
    int ret = 0;

    service_status.last_command = command;
    service_status.last_result = MONA2_BLE_KEYMAP_RESULT_OK;

    switch (command) {
    case MONA2_BLE_KEYMAP_COMMAND_COMMIT:
        if (!staged_valid) {
            service_status.last_result = MONA2_BLE_KEYMAP_RESULT_INVALID_FRAME;
            break;
        }

        ret = mona2_ble_keymap_storage_save(staged_payload, staged_length, staged_hash);
        if (ret < 0) {
            service_status.last_result = MONA2_BLE_KEYMAP_RESULT_STORAGE_ERROR;
            break;
        }

        ret = mona2_ble_keymap_service_apply(staged_payload, staged_length);
        if (ret < 0 && ret != -ENOTSUP) {
            service_status.last_result = MONA2_BLE_KEYMAP_RESULT_APPLY_ERROR;
        }
        break;

    case MONA2_BLE_KEYMAP_COMMAND_ROLLBACK:
        if (committed_blob->available) {
            memcpy(staged_payload, committed_blob->payload, committed_blob->length);
            staged_length = committed_blob->length;
            staged_received = committed_blob->length;
            staged_hash = committed_blob->hash;
            staged_valid = true;
        } else {
            mona2_ble_keymap_reset_draft();
        }
        break;

    case MONA2_BLE_KEYMAP_COMMAND_CLEAR:
        mona2_ble_keymap_reset_draft();
        ret = mona2_ble_keymap_storage_clear();
        if (ret < 0) {
            service_status.last_result = MONA2_BLE_KEYMAP_RESULT_STORAGE_ERROR;
        }
        break;

    case MONA2_BLE_KEYMAP_COMMAND_NOOP:
        break;

    default:
        service_status.last_result = MONA2_BLE_KEYMAP_RESULT_INVALID_FRAME;
        break;
    }

    mona2_ble_keymap_publish_status();
    return len;
}

BT_GATT_SERVICE_DEFINE(
    mona2_ble_keymap_service,
    BT_GATT_PRIMARY_SERVICE(&mona2_keymap_service_uuid),
    BT_GATT_CHARACTERISTIC(&mona2_keymap_status_uuid.uuid,
                           BT_GATT_CHRC_READ | BT_GATT_CHRC_NOTIFY,
                           BT_GATT_PERM_READ, mona2_ble_keymap_status_read, NULL,
                           &service_status),
    BT_GATT_CCC(mona2_ble_keymap_ccc_changed,
                BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),
    BT_GATT_CHARACTERISTIC(&mona2_keymap_payload_uuid.uuid,
                           BT_GATT_CHRC_READ | BT_GATT_CHRC_WRITE,
                           BT_GATT_PERM_READ | BT_GATT_PERM_WRITE,
                           mona2_ble_keymap_payload_read,
                           mona2_ble_keymap_payload_write, NULL),
    BT_GATT_CHARACTERISTIC(&mona2_keymap_command_uuid.uuid,
                           BT_GATT_CHRC_WRITE | BT_GATT_CHRC_WRITE_WITHOUT_RESP,
                           BT_GATT_PERM_WRITE, NULL,
                           mona2_ble_keymap_command_write, NULL));

static int mona2_ble_keymap_service_init(void)
{
    int ret = mona2_ble_keymap_storage_init();
    if (ret < 0) {
        LOG_ERR("failed to initialize keymap storage: %d", ret);
        return ret;
    }

    const struct mona2_ble_keymap_blob *committed_blob = mona2_ble_keymap_storage_get();
    if (committed_blob->available) {
        memcpy(staged_payload, committed_blob->payload, committed_blob->length);
        staged_length = committed_blob->length;
        staged_received = committed_blob->length;
        staged_hash = committed_blob->hash;
        staged_valid = true;
    }

    mona2_ble_keymap_refresh_status();

    if (IS_ENABLED(CONFIG_MONA2_BLE_KEYMAP_SERVICE_LOG_LEVEL_INF)) {
        LOG_INF("mona2 BLE keymap service ready (payload max=%d)",
                CONFIG_MONA2_BLE_KEYMAP_MAX_PAYLOAD_SIZE);
    }

    return 0;
}

SYS_INIT(mona2_ble_keymap_service_init, APPLICATION, 99);
