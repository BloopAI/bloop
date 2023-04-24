use hyperpolyglot::detect_buffer;
use scc::hash_map::Entry;
use std::{
    io::Cursor,
    path::{Path, PathBuf},
};

#[derive(Debug, Default)]
pub struct LanguageInfo {
    path_map: scc::HashMap<PathBuf, Option<&'static str>>,
}

impl LanguageInfo {
    pub fn get(&self, path: &Path, buf: &[u8]) -> Option<&'static str> {
        match self.path_map.entry(path.to_owned()) {
            Entry::Occupied(existing) => existing.get().to_owned(),
            Entry::Vacant(vacant) => {
                let detected = detect_language(path, buf);
                vacant.insert_entry(detected);
                detected
            }
        }
    }

    pub fn most_common_lang(&self) -> Option<&'static str> {
        let counts = scc::HashMap::<&'static str, usize>::default();

        self.path_map.scan(|_, lang| {
            if let Some(l) = lang {
                *counts.entry(l).or_default().get_mut() += 1;
            }
        });

        let (mut max_k, mut max_v) = (None, 0);
        counts.scan(|k, v| {
            if *v > max_v {
                (max_k, max_v) = (Some(*k), *v)
            }
        });

        max_k
    }
}

fn detect_language(path: &Path, buf: &[u8]) -> Option<&'static str> {
    detect_buffer(path, |_| Ok(Cursor::new(buf)))
        .ok()
        .flatten()
        .map(|d| d.language())
}
