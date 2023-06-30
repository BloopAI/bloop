use std::{
    env, fs,
    path::{Path, PathBuf},
};

fn main() {
    if env::var("ORT_DYLIB_PATH").is_err() {
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

        copy(profile_dir);
    } else {
        println!("cargo:rerun-if-env-changed=ORT_DYLIB_PATH");
    }

    tauri_build::build()
}

#[cfg(target_os = "macos")]
fn copy(profile_dir: &Path) {
    let dylib_name = "libonnxruntime.dylib";
    let dylib_path = profile_dir.join(dylib_name);
    fs::copy(
        dylib_path,
        Path::new(".").join("frameworks").join(dylib_name),
    )
    .unwrap();
}

#[cfg(not(target_os = "macos"))]
fn copy(profile_dir: &Path) {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();
    let dylib_name = match target_os.as_str() {
        "linux" => Some("libonnxruntime.so"),
        "macos" => Some("libonnxruntime.dylib"),
        "windows" => None,
        other => panic!("unknown OS {other}"),
    };

    if let Some(dylib_name) = dylib_name {
        let dylib_path = profile_dir.join(dylib_name);
        fs::copy(dylib_path, Path::new(".").join("dylibs").join(dylib_name)).unwrap();
    }
}
