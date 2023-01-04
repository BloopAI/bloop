# bloop App

The bloop app is built using [Tauri](https://github.com/tauri-apps/tauri), a Rust framework for building cross-platform apps.

## Dependencies

As we are building Tauri, we need a complete build environment containing at least:

* AppImageKit
* atk
* clang
* cmake
* dbus
* glib
* gtk3 including webkit-gtk
* npm (usually in the node package)
* openBLAS
* pango
* pnpm
* protobuf
* rustup
* wget

## Setup

All commands should be run from the root directory.

To install dependencies run:
```
pnpm install
```

Then, to build the bloop app locally:
```
npm run build-app
```

Alternatively, to run the app in dev mode:
```
npm run start-app
```

If the build should fail, please delete all `node_modules` directories you may find and try again. `npm` is sometimes obtuse with caches.
