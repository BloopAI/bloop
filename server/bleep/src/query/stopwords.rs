use lazy_regex::regex;
use once_cell::sync::OnceCell;
use std::collections::HashSet;

type StopWords = HashSet<String>;
static STOPWORDS: OnceCell<StopWords> = OnceCell::new();
static STOP_WORDS_LIST: &str = include_str!("stopwords.txt");

fn stop_words() -> &'static StopWords {
    STOPWORDS.get_or_init(|| {
        let mut sw = StopWords::new();
        for w in STOP_WORDS_LIST.lines() {
            sw.insert(w.to_string());
        }
        sw
    })
}

fn phrases<'a>(phrases_iter: impl IntoIterator<Item = &'a str>) -> Vec<Vec<&'a str>> {
    let phrases_iter = phrases_iter.into_iter();
    let mut phrases = Vec::with_capacity(2 * phrases_iter.size_hint().0);
    for s in phrases_iter.filter(|s| !s.is_empty()) {
        let mut phrase = Vec::new();
        for word in s.split_whitespace() {
            if stop_words().contains(&word.to_lowercase()) {
                if !phrase.is_empty() {
                    phrases.push(phrase.clone());
                    phrase.clear();
                }
            } else {
                phrase.push(word);
            }
        }
        if !phrase.is_empty() {
            phrases.push(phrase);
        }
    }
    phrases
}

pub fn remove_stopwords(text: &str) -> String {
    let phrases = phrases(regex!("[^a-zA-Z0-9_/ -]").split(text));
    phrases
        .iter()
        .map(|p| p.join(" ").to_string())
        .collect::<Vec<String>>()
        .join(" ")
}
