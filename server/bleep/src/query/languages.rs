use std::{borrow::Cow, collections::HashSet};

include!(concat!(env!("OUT_DIR"), "/languages.rs"));

pub fn parse_alias(lang: &str) -> Cow<'static, str> {
    if let Some(s) = EXT_MAP.get(lang) {
        (*s).into()
    } else {
        lang.to_ascii_lowercase().into()
    }
}

pub fn proper_case(lower: Cow<str>) -> Cow<str> {
    if let Some(s) = PROPER_CASE_MAP.get(&lower) {
        (*s).into()
    } else {
        lower
    }
}

pub fn list() -> impl Iterator<Item = &'static str> {
    EXT_MAP
        .entries()
        .flat_map(|e| [*e.0, *e.1])
        .collect::<HashSet<_>>()
        .into_iter()
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sample_language_aliases() {
        assert_eq!(parse_alias("rs".into()), "rust");
        assert_eq!(parse_alias("cpp".into()), "c++");
        assert_eq!(parse_alias("as3".into()), "actionscript");
        assert_eq!(parse_alias("bat".into()), "batchfile");
        assert_eq!(parse_alias("md".into()), "markdown");
    }

    #[test]
    fn sample_proper_case() {
        assert_eq!(proper_case("rust".into()), "Rust");
        assert_eq!(proper_case("c++".into()), "C++");
        assert_eq!(proper_case("actionscript".into()), "ActionScript");
        assert_eq!(proper_case("batchfile".into()), "Batchfile");
    }
}
