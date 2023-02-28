# bloop App

The bloop app is built using [Tauri](https://github.com/tauri-apps/tauri), a Rust framework for building cross-platform apps.

## Dependencies

To build the Tauri app you need the following dependencies:
- `rustup`
- `clang` `cmake` `wget`
- `protobuf`
- `onnxruntime`

Linux users need to ensure that the following are present:
- `AppImageKit`
- `atk`
- `dbus`
- `glib` `gtk3` (including `webkit-gtk`)
- `pango`
 
## Setup

All commands should be run from the root directory unless specified otherwise.

To install dependencies run:
```
npm install
```

To build Qdrant run:
```
cd app/desktop
./build.sh build
```

Then, to build the bloop app locally:
```
npm run build-app
```

Alternatively, to run the app in dev mode:
```
npm run start-app
```

If the build fails, delete all `node_modules` directories and try again.
