use std::{
    env, fs,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};

fn main() {
    // we do not require libonnx for apple silicon
    if !is_apple_silicon() {
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
    }

    tauri_build::build()
}

fn copy(profile_dir: &Path) {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();

    let (dylib_names, target_parent) = match target_os.as_str() {
        "macos" => {
            let name = "libonnxruntime.dylib";
            (vec![name], Path::new(".").join("frameworks"))
        }
        "linux" => {
            let name = "libonnxruntime.so";
            (vec![name], Path::new(".").join("dylibs"))
        }
        "windows" => {
            let main = "onnxruntime.dll";
            let providers = "onnxruntime_providers_shared.dll";
            (vec![main, providers], Path::new(".").join("dylibs"))
        }
        other => panic!("unknown OS {other}"),
    };

    for dylib_name in dylib_names {
        let dylib_path = profile_dir.join(dylib_name);
        let target_path = target_parent.join(dylib_name);
        wait_for(&dylib_path);
        println!("target: {target_path:?}, {:?}", env::current_dir());
        fs::copy(dylib_path, target_path).unwrap();
    }
}

fn wait_for(dylib_path: &Path) {
    println!("waiting for: {dylib_path:?}");
    for _ in 0..1000 {
        if dylib_path.exists() {
            return;
        }

        thread::sleep(Duration::from_millis(500));
    }

    panic!("timeout waiting for ort download");
}

fn is_apple_silicon() -> bool {
    let target = env::var("TARGET").unwrap();
    let components: Vec<_> = target.split('-').map(|s| s.to_string()).collect();
    components[0] == "aarch64" && components[2] == "darwin"
}
