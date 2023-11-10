// Portions of this code (the `phrases` function) are modifications of
// https://github.com/yaa110/rake-rs/blob/master/src/rake.rs
// licensed under the MIT License:
/*
Copyright (c) 2018 Navid Fathollahzade

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
*/

use lazy_regex::regex;
use once_cell::sync::Lazy;
use std::collections::HashSet;

type StopWords = HashSet<&'static str>;

static STOPWORDS: Lazy<StopWords> = Lazy::new(|| {
    let word_list = include_str!("stopwords.txt");
    let mut sw = StopWords::new();
    for w in word_list.lines() {
        sw.insert(w);
    }
    sw
});

/// Extract `phrases`, where each phrase is a sequence of non-stopwords
fn phrases<'a>(phrases_iter: impl IntoIterator<Item = &'a str>) -> Vec<Vec<&'a str>> {
    let phrases_iter = phrases_iter.into_iter();
    let mut phrases = Vec::with_capacity(2 * phrases_iter.size_hint().0);
    for s in phrases_iter.filter(|s| !s.is_empty()) {
        let mut phrase = Vec::new();
        for word in s.split_whitespace() {
            if STOPWORDS.contains(word.to_lowercase().as_str()) {
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
    phrases.into_iter().flatten().collect::<Vec<_>>().join(" ")
}
