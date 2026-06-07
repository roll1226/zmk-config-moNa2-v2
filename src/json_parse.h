/**
 * Minimal single-header JSON string-array reader for the mona2 keymap service.
 *
 * Only the subset needed to extract string arrays from the received payload is
 * implemented.  No dynamic allocation is used; all values are returned as
 * length-delimited pointers into the original buffer.
 */

#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

/* A view into the source buffer — not NUL-terminated. */
struct mona2_json_str {
    const char *ptr;
    size_t length;
};

static inline bool mona2_json_str_eq(const struct mona2_json_str *s, const char *literal)
{
    return s->length == strlen(literal) && strncmp(s->ptr, literal, s->length) == 0;
}

/**
 * Copies up to @buf_size - 1 bytes from @s into @buf and NUL-terminates it.
 * Returns true on success.
 */
static inline bool mona2_json_str_copy(char *buf, size_t buf_size,
                                       const struct mona2_json_str *s)
{
    if (buf_size == 0U) {
        return false;
    }

    size_t copy_length = s->length < buf_size - 1U ? s->length : buf_size - 1U;
    memcpy(buf, s->ptr, copy_length);
    buf[copy_length] = '\0';
    return s->length < buf_size;
}

/* ── internal helpers ──────────────────────────────────────────────── */

static inline const char *mona2_json_skip_ws(const char *p, const char *end)
{
    while (p < end && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) {
        p++;
    }

    return p;
}

/**
 * Advances @p past a JSON string literal (including quotes) and fills @out.
 * Returns the position after the closing '"', or NULL on parse error.
 */
static inline const char *mona2_json_read_string(const char *p, const char *end,
                                                  struct mona2_json_str *out)
{
    if (p >= end || *p != '"') {
        return NULL;
    }

    p++; /* skip opening quote */
    const char *start = p;

    while (p < end && *p != '"') {
        if (*p == '\\') {
            p++; /* skip escaped character */
        }

        p++;
    }

    if (p >= end) {
        return NULL;
    }

    out->ptr = start;
    out->length = (size_t)(p - start);
    return p + 1; /* skip closing quote */
}

/**
 * Skips any single JSON value (string, number, object, array, literal).
 * Returns position after the value, or NULL on error.
 */
static const char *mona2_json_skip_value(const char *p, const char *end);

static inline const char *mona2_json_skip_value(const char *p, const char *end)
{
    p = mona2_json_skip_ws(p, end);
    if (p >= end) {
        return NULL;
    }

    if (*p == '"') {
        struct mona2_json_str dummy;
        return mona2_json_read_string(p, end, &dummy);
    }

    if (*p == '{') {
        p++;
        int depth = 1;

        while (p < end && depth > 0) {
            if (*p == '{') {
                depth++;
            } else if (*p == '}') {
                depth--;
            } else if (*p == '"') {
                struct mona2_json_str dummy;
                p = mona2_json_read_string(p, end, &dummy);
                if (!p) {
                    return NULL;
                }

                continue;
            }

            p++;
        }

        return p;
    }

    if (*p == '[') {
        p++;
        int depth = 1;

        while (p < end && depth > 0) {
            if (*p == '[') {
                depth++;
            } else if (*p == ']') {
                depth--;
            } else if (*p == '"') {
                struct mona2_json_str dummy;
                p = mona2_json_read_string(p, end, &dummy);
                if (!p) {
                    return NULL;
                }

                continue;
            }

            p++;
        }

        return p;
    }

    /* number, true, false, null */
    while (p < end && *p != ',' && *p != '}' && *p != ']' &&
           *p != ' ' && *p != '\t' && *p != '\r' && *p != '\n') {
        p++;
    }

    return p;
}

/**
 * Iterates the string array at @array_start (positioned after '[').
 *
 * Calls @cb for each string element.  Stops when @cb returns false or the
 * array ends.  Returns true on success.
 */
static inline bool mona2_json_iter_string_array(
        const char *array_start, const char *end,
        bool (*cb)(size_t index, const struct mona2_json_str *value, void *ctx),
        void *ctx)
{
    const char *p = mona2_json_skip_ws(array_start, end);
    size_t index = 0U;

    while (p < end && *p != ']') {
        p = mona2_json_skip_ws(p, end);
        if (p >= end || *p == ']') {
            break;
        }

        struct mona2_json_str value;
        p = mona2_json_read_string(p, end, &value);
        if (!p) {
            return false;
        }

        if (!cb(index, &value, ctx)) {
            break;
        }

        index++;
        p = mona2_json_skip_ws(p, end);
        if (p < end && *p == ',') {
            p++;
        }
    }

    return true;
}

/**
 * Finds the value of the string key @key inside the JSON object starting
 * at @obj_start (positioned after '{').  If found and the value is a string,
 * fills @out and returns the position after the value.  If the value is an
 * array or object, returns the position after it with @out unchanged.
 * Returns NULL if the key is not found or on parse error.
 */
static inline const char *mona2_json_find_key(const char *obj_start, const char *end,
                                               const char *key,
                                               struct mona2_json_str *out)
{
    const char *p = mona2_json_skip_ws(obj_start, end);

    while (p < end && *p != '}') {
        p = mona2_json_skip_ws(p, end);
        if (p >= end || *p == '}') {
            break;
        }

        struct mona2_json_str k;
        p = mona2_json_read_string(p, end, &k);
        if (!p) {
            return NULL;
        }

        p = mona2_json_skip_ws(p, end);
        if (p >= end || *p != ':') {
            return NULL;
        }

        p++;
        p = mona2_json_skip_ws(p, end);

        bool is_target = (k.length == strlen(key) &&
                          strncmp(k.ptr, key, k.length) == 0);

        if (is_target) {
            if (p < end && *p == '"') {
                return mona2_json_read_string(p, end, out);
            }

            return p; /* caller inspects the raw value position */
        }

        p = mona2_json_skip_value(p, end);
        if (!p) {
            return NULL;
        }

        p = mona2_json_skip_ws(p, end);
        if (p < end && *p == ',') {
            p++;
        }
    }

    return NULL;
}
