use std::{
    env, fs,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};

fn main() {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let profile_dir = out_dir
        // "target/.../build/bloop-hash"
        .parent()
        .unwrap()
        // "target/.../build"
        .parent()
        .unwrap()
        // "target/.../"
        .parent()
        .unwrap();

    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();

    let dylib_name = match target_os.as_str() {
        "linux" => Some("libonnxruntime.so"),
        "macos" => Some("libonnxruntime.dylib"),
        "windows" => None,
        other => panic!("unknown OS {other}"),
    };

    if let Some(dylib_name) = dylib_name {
        let dylib_path = profile_dir.join(dylib_name);

        while !dylib_path.exists() {
            thread::sleep(Duration::from_millis(500));
        }

        fs::copy(dylib_path, Path::new(".").join("dylibs").join(dylib_name)).unwrap();
    }

    tauri_build::build()
}
