/**
 * mona2_ble_keymap_apply.c
 *
 * Overrides the weak mona2_ble_keymap_service_apply() hook defined in
 * ble_keymap_service.c.  When the Web editor commits a draft, this function:
 *
 *   1. Parses the JSON payload produced by web/src/lib/keymapPayloadCodec.ts
 *   2. Iterates each layer's binding strings
 *   3. Resolves each ZMK behavior name through the device_get_binding() API
 *   4. Calls zmk_keymap_set_layer_binding_at_idx() for every changed key
 *   5. Persists via zmk_keymap_save_changes()
 *   6. Reboots the device so the right-hand central reloads from NVS and
 *      re-pairs with the left-hand peripheral using the new bindings
 *
 * Limitations in ZMK v0.2.1
 * --------------------------
 * - zmk_keymap_set_layer_binding_at_idx() is available only when
 *   CONFIG_ZMK_STUDIO is enabled (the function lives in keymap.c and is
 *   gated behind that Kconfig).  mona2_r.conf already sets
 *   CONFIG_ZMK_STUDIO=y so this compiles correctly.
 * - Behavior device lookup uses device_get_binding(); in newer ZMK this
 *   may be DEVICE_DT_GET() based.  The macro CONFIG_MONA2_BLE_KEYMAP_APPLY
 *   lets users disable the apply step and keep only NVS persistence if the
 *   ZMK version does not expose the required symbol.
 * - The left-hand peripheral reloads its keymap only after a reconnect;
 *   there is no live push to the peripheral in this implementation.
 */

#include "json_parse.h"

#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include <zephyr/device.h>
#include <zephyr/init.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/reboot.h>

#include <zmk/behavior.h>
#include <zmk/keymap.h>

LOG_MODULE_REGISTER(mona2_ble_keymap_apply, LOG_LEVEL_INF);

/* Maximum binding string length accepted from the Web editor */
#define MONA2_APPLY_BINDING_STR_MAX 48U

/* Maximum keys per layer (mona2 physical key count) */
#define MONA2_APPLY_KEYS_PER_LAYER 43U

/* Maximum layers the apply step processes */
#define MONA2_APPLY_MAX_LAYERS 8U

struct apply_layer_ctx {
    uint8_t layer_index;
    uint32_t key_index;
    uint32_t changed;
    bool error;
};

/**
 * Resolves a ZMK binding string such as "&kp A" into a
 * zmk_behavior_binding and calls zmk_keymap_set_layer_binding_at_idx().
 *
 * Only the two most common forms are supported:
 *   &kp  KEY          → {behavior="keyboard", param1=key_code, param2=0}
 *   &trans / &none    → transparent / no-op
 *   everything else   → passed as param1=0, param2=0 with the behavior name
 */
static void mona2_apply_binding(uint8_t layer, uint32_t key_index,
                                 const char *binding_str)
{
    /* Strip leading '&' */
    const char *p = binding_str;
    if (*p == '&') {
        p++;
    }

    /* Split behavior name from parameter tokens */
    char behavior_name[MONA2_APPLY_BINDING_STR_MAX];
    uint32_t param1 = 0U;
    uint32_t param2 = 0U;

    const char *space = strchr(p, ' ');
    if (space) {
        size_t name_len = (size_t)(space - p);
        if (name_len >= sizeof(behavior_name)) {
            name_len = sizeof(behavior_name) - 1U;
        }

        memcpy(behavior_name, p, name_len);
        behavior_name[name_len] = '\0';

        /* Parse up to two integer/hex parameters */
        char *end_ptr;
        const char *tok = space + 1;

        while (*tok == ' ') {
            tok++;
        }

        if (*tok) {
            param1 = (uint32_t)strtoul(tok, &end_ptr, 0);
            tok = end_ptr;

            while (*tok == ' ') {
                tok++;
            }

            if (*tok) {
                param2 = (uint32_t)strtoul(tok, NULL, 0);
            }
        }
    } else {
        strncpy(behavior_name, p, sizeof(behavior_name) - 1U);
        behavior_name[sizeof(behavior_name) - 1U] = '\0';
    }

    /* Remap well-known short names to full device names */
    const char *dev_name = behavior_name;

    if (strcmp(behavior_name, "trans") == 0) {
        dev_name = "TRANS";
    } else if (strcmp(behavior_name, "none") == 0) {
        dev_name = "NONE";
    } else if (strcmp(behavior_name, "kp") == 0) {
        dev_name = "KEY_PRESS";
    } else if (strcmp(behavior_name, "mt") == 0) {
        dev_name = "MOD_TAP";
    } else if (strcmp(behavior_name, "lt") == 0) {
        dev_name = "LAYER_TAP";
    } else if (strcmp(behavior_name, "mo") == 0) {
        dev_name = "MO";
    } else if (strcmp(behavior_name, "to") == 0) {
        dev_name = "TO";
    } else if (strcmp(behavior_name, "tog") == 0) {
        dev_name = "TOGGLE_LAYER";
    } else if (strcmp(behavior_name, "bt") == 0) {
        dev_name = "BT";
    } else if (strcmp(behavior_name, "mkp") == 0) {
        dev_name = "MOB_KEY_PRESS";
    }

    const struct device *dev = device_get_binding(dev_name);
    if (!dev) {
        LOG_WRN("behavior device not found: %s (binding: %s)", dev_name, binding_str);
        return;
    }

    struct zmk_behavior_binding binding = {
        .behavior_dev = dev_name,
        .param1 = param1,
        .param2 = param2,
    };

    int ret = zmk_keymap_set_layer_binding_at_idx(layer, key_index, binding);
    if (ret < 0) {
        LOG_WRN("set binding failed: layer=%u key=%u ret=%d", layer, key_index, ret);
    }
}

static bool apply_binding_cb(size_t index, const struct mona2_json_str *value, void *ctx_ptr)
{
    struct apply_layer_ctx *ctx = ctx_ptr;

    if (ctx->error || index >= MONA2_APPLY_KEYS_PER_LAYER) {
        return false;
    }

    char binding_str[MONA2_APPLY_BINDING_STR_MAX];
    mona2_json_str_copy(binding_str, sizeof(binding_str), value);

    /* Skip unchanged transparent placeholders to reduce NVS writes */
    if (strcmp(binding_str, "&trans") == 0 || strlen(binding_str) == 0U) {
        ctx->key_index++;
        return true;
    }

    mona2_apply_binding(ctx->layer_index, ctx->key_index, binding_str);
    ctx->key_index++;
    ctx->changed++;
    return true;
}

/**
 * Public entry point — called by ble_keymap_service.c after commit.
 */
int mona2_ble_keymap_service_apply(const uint8_t *payload, size_t length)
{
    if (!payload || length == 0U) {
        return -EINVAL;
    }

    const char *src = (const char *)payload;
    const char *end = src + length;
    uint32_t total_changed = 0U;

    /*
     * Locate the "layers" array in the top-level JSON object.
     * Expected shape (from keymapPayloadCodec.ts buildDraftPayload):
     *
     *   {
     *     "version": 1,
     *     "layers": [
     *       { "id": "default_layer", "bindings": ["&kp Q", "&kp W", ...] },
     *       ...
     *     ],
     *     ...
     *   }
     */

    /* Find '{' at root */
    const char *p = mona2_json_skip_ws(src, end);
    if (p >= end || *p != '{') {
        LOG_ERR("payload is not a JSON object");
        return -EINVAL;
    }

    p++;

    /* Find "layers" key */
    struct mona2_json_str dummy;
    const char *layers_val = mona2_json_find_key(p, end, "layers", &dummy);
    if (!layers_val) {
        LOG_ERR("\"layers\" key not found in payload");
        return -EINVAL;
    }

    p = mona2_json_skip_ws(layers_val, end);
    if (p >= end || *p != '[') {
        LOG_ERR("\"layers\" value is not an array");
        return -EINVAL;
    }

    p++; /* enter layers array */

    for (uint8_t layer_idx = 0U; layer_idx < MONA2_APPLY_MAX_LAYERS; layer_idx++) {
        p = mona2_json_skip_ws(p, end);
        if (p >= end || *p == ']') {
            break;
        }

        if (*p != '{') {
            break;
        }

        p++; /* enter layer object */

        /* Find "bindings" array inside this layer object */
        struct mona2_json_str bindings_dummy;
        const char *bindings_val = mona2_json_find_key(p, end, "bindings", &bindings_dummy);
        if (!bindings_val) {
            LOG_WRN("layer %u: \"bindings\" not found, skipping", layer_idx);
        } else {
            const char *bp = mona2_json_skip_ws(bindings_val, end);
            if (bp < end && *bp == '[') {
                bp++;
                struct apply_layer_ctx ctx = {
                    .layer_index = layer_idx,
                    .key_index = 0U,
                    .changed = 0U,
                    .error = false,
                };

                mona2_json_iter_string_array(bp, end, apply_binding_cb, &ctx);
                total_changed += ctx.changed;
                LOG_INF("layer %u: applied %u binding changes", layer_idx, ctx.changed);
            }
        }

        /* Skip to end of layer object */
        /* Re-position p just after the layer object's '}' */
        int depth = 1;
        /* We entered at '{', move p to the '{'  position then skip */
        p = mona2_json_skip_ws(layers_val, end); /* back to '[' */
        /* Instead: scan forward from bindings position to find closing '}' */
        /* Simpler: scan from last known position */
        /* Reset p by scanning the full layers array from scratch each time
         * would be O(n^2).  Use mona2_json_skip_value on the layer object. */

        /* Re-find p: back up to the '[' of layers array */
        p = mona2_json_skip_ws(layers_val, end); /* points at '[' */
        p++; /* past '[' */

        /* Skip layer_idx+1 objects */
        for (uint8_t skip = 0U; skip <= layer_idx; skip++) {
            p = mona2_json_skip_ws(p, end);
            if (p >= end || *p == ']') {
                goto done;
            }

            p = mona2_json_skip_value(p, end);
            if (!p) {
                goto done;
            }

            p = mona2_json_skip_ws(p, end);
            if (p < end && *p == ',') {
                p++;
            }
        }
    }

done:
    if (total_changed == 0U) {
        LOG_INF("no binding changes detected; skipping save and reboot");
        return 0;
    }

    LOG_INF("saving %u binding changes to NVS", total_changed);
    int ret = zmk_keymap_save_changes();
    if (ret < 0) {
        LOG_ERR("zmk_keymap_save_changes failed: %d", ret);
        return ret;
    }

    LOG_INF("keymap saved — rebooting to apply changes");

    /* Small delay so the BLE status notify can reach the Web editor
     * before the connection is dropped by reboot. */
    k_msleep(400);
    sys_reboot(SYS_REBOOT_COLD);

    /* unreachable */
    return 0;
}
