use std::borrow::Cow;

include!(concat!(env!("OUT_DIR"), "/languages.rs"));

pub fn parse_alias(lang: Cow<str>) -> Cow<str> {
    if let Some(s) = EXT_MAP.get(&lang) {
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
