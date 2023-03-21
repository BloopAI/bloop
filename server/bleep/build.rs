use std::{
    collections::HashMap,
    env,
    ffi::OsStr,
    fs::File,
    io::{BufWriter, Write},
    path::Path,
};

#[derive(serde::Deserialize)]
struct Language {
    r#type: String,
    aliases: Option<Vec<String>>,
}
fn main() {
    set_index_version();
    process_languages();
}

fn set_index_version() {
    use std::fs::{read_dir, read_to_string};

    let model_directories = &["src/indexes", "src/intelligence/scope_resolution"];
    let model_files = &[
        "src/indexes.rs",
        "src/intelligence/scope_resolution.rs",
        "../languages.yml",
    ];

    let mut hasher = blake3::Hasher::new();
    for path in model_files {
        hasher.update(read_to_string(path).unwrap().as_bytes());
        println!("cargo:rerun-if-changed={path}");
    }

    for path in model_directories
        .iter()
        .flat_map(|dir| read_dir(dir).unwrap())
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            if Some(OsStr::new("rs")) == path.extension() {
                Some(path)
            } else {
                None
            }
        })
    {
        hasher.update(read_to_string(&path).unwrap().as_bytes());
        println!("cargo:rerun-if-changed={}", path.to_string_lossy());
    }

    let version_file = Path::new(&env::var("OUT_DIR").unwrap()).join("schema_version.rs");
    write!(
        File::create(version_file).unwrap(),
        r#"pub const SCHEMA_VERSION: &str = "{}";"#,
        hasher.finalize()
    )
    .unwrap();
}

fn process_languages() {
    let langs_file = File::open("../languages.yml").unwrap();
    let langs: HashMap<String, Language> = serde_yaml::from_reader(langs_file).unwrap();

    let languages_path = Path::new(&env::var("OUT_DIR").unwrap()).join("languages.rs");
    let mut ext_map = phf_codegen::Map::new();
    let mut case_map = phf_codegen::Map::new();

    for (name, data) in langs
        .into_iter()
        .filter(|(_, d)| d.r#type == "programming" || d.r#type == "prose")
    {
        let name_lower = name.to_ascii_lowercase();

        for alias in data.aliases.unwrap_or_default() {
            ext_map.entry(alias, &format!("\"{name_lower}\""));
        }

        case_map.entry(name_lower, &format!("\"{name}\""));
    }

    write!(
        BufWriter::new(File::create(languages_path).unwrap()),
        "static EXT_MAP: phf::Map<&str, &str> = \n{};\n\
         static PROPER_CASE_MAP: phf::Map<&str, &str> = \n{};\n",
        ext_map.build(),
        case_map.build(),
    )
    .unwrap();

    println!("cargo:rerun-if-changed=../languages.yml");
}
