zephyr_library_named(mona2_extensions)
zephyr_library_sources_ifdef(CONFIG_MONA2_BLE_KEYMAP_SERVICE src/ble_keymap_storage.c)
zephyr_library_sources_ifdef(CONFIG_MONA2_BLE_KEYMAP_SERVICE src/ble_keymap_service.c)
zephyr_library_sources_ifdef(CONFIG_MONA2_BLE_KEYMAP_APPLY   src/ble_keymap_apply.c)

# ZMK app headers (zmk/behavior.h, zmk/keymap.h, etc.) are not added
# automatically to external modules.  Expose them explicitly.
if(CONFIG_MONA2_BLE_KEYMAP_SERVICE)
  target_include_directories(mona2_extensions PRIVATE ${APPLICATION_SOURCE_DIR}/include)
endif()
