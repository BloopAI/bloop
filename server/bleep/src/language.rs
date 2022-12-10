use hyperpolyglot::detect;
use ignore::WalkBuilder;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

#[derive(Debug)]
pub struct LanguageInfo {
    pub path_map: HashMap<PathBuf, Option<&'static str>>,
    pub most_common_lang: Option<&'static str>,
}

pub fn get_language_info<P: AsRef<Path>>(path: P) -> LanguageInfo {
    let threads = std::thread::available_parallelism()
        .expect("Can't get available threads")
        .get();

    // Logic taken from https://github.com/monkslc/hyperpolyglot/blob/master/src/lib.rs.
    // Sadly Hyperpolyglot's `get_language_breakdown` function is hardcoded to ignore
    // documentation and vendored code, so we reimplement its functionality here.
    let walker = WalkBuilder::new(path)
        .ignore(true)
        .git_ignore(true)
        .hidden(false)
        .threads(threads)
        .build_parallel();

    let (tx, rx) = flume::unbounded();

    walker.run(|| {
        let tx = tx.clone();
        Box::new(move |result| {
            use ignore::WalkState::*;

            if let Ok(path) = result {
                let path = path.into_path();
                if !path.is_dir() {
                    let detection = match detect(&path) {
                        Ok(d) => d,
                        _ => None,
                    };
                    tx.send((path, detection)).unwrap();
                }
            }
            Continue
        })
    });

    drop(tx);

    let mut path_map = HashMap::new();
    let mut counts = HashMap::<&'static str, usize>::new();
    for (path, detection) in rx {
        let lang = detection.map(|d| d.language());
        path_map.insert(path, lang);

        // count recognized langs
        if let Some(l) = lang {
            *counts.entry(l).or_default() += 1;
        }
    }

    let most_common_lang = counts.into_iter().max_by_key(|(_, v)| *v).map(|(k, _)| k);

    LanguageInfo {
        path_map,
        most_common_lang,
    }
}
