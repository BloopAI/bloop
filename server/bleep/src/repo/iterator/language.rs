use hyperpolyglot::detect_buffer;
use std::{io::Cursor, path::PathBuf};

use super::FileSource;

#[derive(Debug)]
pub struct LanguageInfo {
    pub path_map: scc::HashMap<PathBuf, Option<&'static str>>,
    pub most_common_lang: Option<&'static str>,
}

pub fn aggregate(iterator: impl FileSource) -> LanguageInfo {
    let path_map = scc::HashMap::default();
    let counts = scc::HashMap::<&'static str, usize>::default();

    iterator.for_each(|file| {
        let path = PathBuf::from(&file.path);
        if file.kind.is_file() {
            let detection = match detect_buffer(&path, |_| Ok(Cursor::new(&file.buffer))) {
                Ok(d) => d,
                _ => None,
            };

            let lang = detection.map(|d| d.language());

            // ignore duplicate files that come from the iterator
            _ = path_map.insert(path, lang);

            if let Some(l) = lang {
                *counts.entry(l).or_default().get_mut() += 1;
            }
        }
    });

    let (mut max_k, mut max_v) = (None, 0);
    counts.scan(|k, v| {
        if *v > max_v {
            (max_k, max_v) = (Some(*k), *v)
        }
    });

    LanguageInfo {
        path_map,
        most_common_lang: max_k,
    }
}
