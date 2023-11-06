// external
use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use regex::Regex;
use reqwest::{
    header::{HeaderMap, USER_AGENT},
    redirect::Policy,
    IntoUrl,
};
use select::{
    document::Document,
    node::{Descendants, Node},
    predicate::{Attr, Name, Predicate},
};
use url::Url;

use crate::query::languages::{EXT_MAP, PROPER_CASE_MAP};

use std::{
    borrow::Cow,
    collections::{HashMap, HashSet},
    ops::Deref,
    str::FromStr,
    time::Duration,
};

static RE_BAD_NODES_ATTR: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r###"(?mi)^side$|combx|retweet|mediaarticlerelated|menucontainer|navbar|storytopbar-bucket|utility-bar|inline-share-tools|comment|PopularQuestions|contact|foot(er|note)?|cnn_strycaptiontxt|cnn_html_slideshow|cnn_strylftcntnt|links|meta$|shoutbox|sponsor|tags|socialnetworking|socialNetworking|cnnStryHghLght|cnn_stryspcvbx|^inset$|pagetools|post-attributes|welcome_form|contentTools2|the_answers|communitypromo|runaroundLeft|subscribe|vcard|articleheadings|date|^print$|popup|author-dropdown|tools|socialtools|byline|konafilter|breadcrumbs|^fn$|wp-caption-text|legende|ajoutVideo|timestamp|js_replies|[^-]facebook(-broadcasting)?|google|[^-]twitter|styln-briefing-block|read-more-link|js-body-read-more"###).unwrap()
});
const PUNCTUATION: &str = r#",."'!?&-/:;()#$%*+<=>@[\]^_`{|}~"#;
const ARTICLE_BODY_ATTR: &[(&str, &str); 3] = &[
    ("itemprop", "articleBody"),
    ("data-testid", "article-body"),
    ("name", "articleBody"),
];
const BAD_NODE_NAMES: &[&str; 9] = &[
    "nav",
    "script",
    "style",
    "figcaption",
    "figure",
    "button",
    "summary",
    "aside",
    // astro components - the top level astro-island should suffice
    "astro-island",
];
const ATTR_TO_CHECK: [&str; 3] = ["id", "class", "name"];

#[derive(Debug, Default)]
struct DefaultExtractor;

impl Extractor for DefaultExtractor {}

trait Extractor {
    fn title<'a>(&self, doc: &'a Document) -> Option<Cow<'a, str>> {
        if let Some(title) = doc.find(Name("title")).next() {
            return Some(Cow::Owned(title.text()));
        }

        if let Some(title) = self.meta_content(doc, Attr("property", "og:title")) {
            return Some(title);
        }

        if let Some(title) = self.meta_content(doc, Attr("name", "og:title")) {
            return Some(title);
        }

        if let Some(title) = doc
            .find(Name("h1"))
            .filter_map(|node| node.as_text().map(str::trim))
            .next()
        {
            return Some(Cow::Borrowed(title));
        }
        None
    }

    fn base_url(&self, doc: &Document) -> Option<Url> {
        doc.find(Name("base"))
            .filter_map(|n| n.attr("href"))
            .filter_map(|href| Url::parse(href).ok())
            .next()
    }

    fn meta_language(&self, doc: &Document) -> Option<Language> {
        let mut unknown_lang = None;

        if let Some(meta) = self.meta_content(doc, Attr("http-equiv", "Content-Language")) {
            match Language::from_str(&meta) {
                Ok(lang) => return Some(lang),
                Err(lang) => {
                    unknown_lang = Some(lang);
                }
            }
        }

        if let Some(meta) = self.meta_content(doc, Attr("name", "lang")) {
            match Language::from_str(&meta) {
                Ok(lang) => return Some(lang),
                Err(lang) => {
                    unknown_lang = Some(lang);
                }
            }
        }
        unknown_lang
    }

    fn meta_content<'a, 'b>(
        &self,
        doc: &'a Document,
        attr: Attr<&'b str, &'b str>,
    ) -> Option<Cow<'a, str>> {
        doc.find(Name("head").descendant(Name("meta").and(attr)))
            .filter_map(|node| {
                node.attr("content")
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(Cow::Borrowed)
            })
            .next()
    }

    fn meta_site_name<'a>(&self, doc: &'a Document) -> Option<Cow<'a, str>> {
        self.meta_content(doc, Attr("property", "og:site_name"))
    }

    /// If the article has meta description set in the source, use that
    fn meta_description<'a>(&self, doc: &'a Document) -> Option<Cow<'a, str>> {
        [("property", "description"), ("name", "description")]
            .iter()
            .filter_map(|(k, v)| self.meta_content(doc, Attr(k, v)))
            .next()
    }

    fn icon<'a>(&self, doc: &'a Document) -> Cow<'a, str> {
        Cow::Borrowed(
            doc.find(Name("head").descendant(
                Name("link").and(Attr("rel", "icon").or(Attr("rel", "shortcut icon"))),
            ))
            .find_map(|node| node.attr("href").map(str::trim).filter(|s| !s.is_empty()))
            .unwrap_or("/favicon.ico"),
        )
    }

    fn text<'a>(&self, doc: &'a Document, lang: Language) -> Option<Cow<'a, str>> {
        self.text_with_cleaner(doc, lang, DefaultDocumentCleaner)
    }

    fn text_with_cleaner<'a, T: DocumentCleaner>(
        &self,
        doc: &'a Document,
        lang: Language,
        cleaner: T,
    ) -> Option<Cow<'a, str>> {
        self.article_node(doc, lang)
            .map(|n| cleaner.clean_node_text(*n).into())
    }

    fn article_node<'a>(&self, doc: &'a Document, lang: Language) -> Option<ArticleTextNode<'a>> {
        let mut iter =
            doc.find(Name("body").descendant(ArticleTextNodeExtractor::article_body_predicate()));
        if let Some(node) = iter.next() {
            if iter.next().is_none() {
                return Some(ArticleTextNode::new(node));
            }
        }
        ArticleTextNodeExtractor::calculate_best_node(doc, lang)
    }

    fn all_urls<'a>(&self, doc: &'a Document) -> Vec<Cow<'a, str>> {
        let mut uniques = HashSet::new();
        doc.find(Name("a"))
            .filter_map(|n| n.attr("href").map(str::trim))
            .filter(|href| uniques.insert(*href))
            .map(Cow::Borrowed)
            .collect()
    }

    fn article_content<'a>(&self, doc: &'a Document, lang: Option<Language>) -> ArticleContent<'a> {
        let mut builder = ArticleContent::builder();

        let lang = if let Some(meta_lang) = self.meta_language(doc) {
            builder = builder.language(meta_lang.clone());
            meta_lang
        } else {
            lang.unwrap_or_default()
        };

        if let Some(description) = self.meta_description(doc) {
            builder = builder.description(description);
        }

        if let Some(title) = self.title(doc) {
            builder = builder.title(title);
        }

        builder = builder.icon(self.icon(doc));

        if let Some(txt_node) = self.article_node(doc, lang) {
            builder = builder.text(txt_node.clean_text().into());
        }

        builder.build()
    }

    fn canonical_link(&self, doc: &Document) -> Option<Url> {
        if let Some(link) = doc
            .find(Name("link").and(Attr("rel", "canonical")))
            .filter_map(|node| node.attr("href"))
            .next()
        {
            return Url::parse(link).ok();
        }

        if let Some(meta) = self.meta_content(doc, Attr("property", "og:url")) {
            return Url::parse(&meta).ok();
        }

        None
    }
}

#[derive(Debug)]
pub struct Article {
    pub url: Url,
    pub doc: Document,
    pub content: ArticleContent<'static>,
    pub language: Language,
}

impl Article {
    pub fn builder<T: IntoUrl>(url: T) -> Result<ArticleBuilder> {
        ArticleBuilder::new(url)
    }
}

#[derive(Debug, Clone)]
pub struct ArticleContent<'a> {
    pub title: Option<Cow<'a, str>>,
    pub icon: Option<Cow<'a, str>>,
    pub language: Option<Language>,
    pub description: Option<Cow<'a, str>>,
    pub text: Option<Cow<'a, str>>,
}

impl<'a> ArticleContent<'a> {
    fn builder() -> ArticleContentBuilder<'a> {
        ArticleContentBuilder::default()
    }

    fn into_owned(self) -> ArticleContent<'static> {
        ArticleContent {
            title: self.title.map(Cow::into_owned).map(Cow::Owned),
            icon: self.icon.map(Cow::into_owned).map(Cow::Owned),
            language: self.language,
            description: self.description.map(Cow::into_owned).map(Cow::Owned),
            text: self.text.map(Cow::into_owned).map(Cow::Owned),
        }
    }
}
#[derive(Debug, Default)]
struct ArticleContentBuilder<'a> {
    title: Option<Cow<'a, str>>,
    icon: Option<Cow<'a, str>>,
    text: Option<Cow<'a, str>>,
    language: Option<Language>,
    description: Option<Cow<'a, str>>,
}

impl<'a> ArticleContentBuilder<'a> {
    fn title(mut self, title: Cow<'a, str>) -> Self {
        self.title = Some(title);
        self
    }

    fn icon(mut self, icon: Cow<'a, str>) -> Self {
        self.icon = Some(icon);
        self
    }

    fn text(mut self, text: Cow<'a, str>) -> Self {
        self.text = Some(text);
        self
    }

    fn language(mut self, language: Language) -> Self {
        self.language = Some(language);
        self
    }

    fn description(mut self, description: Cow<'a, str>) -> Self {
        self.description = Some(description);
        self
    }

    fn build(self) -> ArticleContent<'a> {
        ArticleContent {
            title: self.title,
            icon: self.icon,
            text: self.text,
            description: self.description,
            language: self.language,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum Language {
    Arabic,
    Russian,
    Dutch,
    German,
    #[default]
    English,
    Spanish,
    French,
    Hebrew,
    Italian,
    Korean,
    Norwegian,
    Persian,
    Polish,
    Portuguese,
    Swedish,
    Hungarian,
    Finnish,
    Danish,
    Chinese,
    Indonesian,
    Vietnamese,
    Swahili,
    Turkish,
    Greek,
    Ukrainian,
    Other(String),
}

impl Language {
    fn stopword_count(&self, txt: &str) -> Option<usize> {
        Some(ArticleTextNodeExtractor::words(txt).count())
    }
}

pub struct ArticleBuilder {
    url: Option<Url>,
    timeout: Option<Duration>,
    language: Option<Language>,
    browser_user_agent: Option<String>,
}

impl ArticleBuilder {
    fn new<T: IntoUrl>(url: T) -> Result<Self> {
        let url = url.into_url()?;

        Ok(ArticleBuilder {
            url: Some(url),
            timeout: None,
            language: None,
            browser_user_agent: None,
        })
    }

    pub async fn get(self) -> Result<Article> {
        self.get_with_extractor(&DefaultExtractor).await
    }

    async fn get_with_extractor<TExtract: Extractor>(
        self,
        extractor: &TExtract,
    ) -> Result<Article> {
        let url = self
            .url
            .context("Url of the article must be initialized.")?;

        let builder = {
            let timeout = self.timeout.unwrap_or_else(|| Duration::from_secs(5));

            let mut headers = HeaderMap::with_capacity(1);

            headers.insert(
                USER_AGENT,
                self.browser_user_agent
                    .map(|x| x.parse())
                    .unwrap_or_else(|| {
                        format!("bloop/{} bloop-doc-scraper", env!("CARGO_PKG_VERSION")).parse()
                    })
                    .context("Failed to parse user agent header.")?,
            );

            reqwest::Client::builder()
                .default_headers(headers)
                .redirect(Policy::limited(2))
                .timeout(timeout)
        };

        let client = builder.build()?;
        let resp = client.get(url).send().await?;

        if !resp.status().is_success() {
            return Err(anyhow::anyhow!(
                "Unsuccessful request to {:?} ({})",
                resp.url(),
                resp.status()
            ));
        }

        let url = resp.url().to_owned();
        let doc = Document::from_read(&*resp.bytes().await?)
            .context(format!("Failed to read {:?} html as document.", url))?;

        let content = extractor
            .article_content(&doc, self.language.clone())
            .into_owned();

        Ok(Article {
            url,
            doc,
            content,
            language: self.language.unwrap_or_default(),
        })
    }
}

struct MetaNode<'a> {
    inner: Node<'a>,
}

impl<'a> Deref for MetaNode<'a> {
    type Target = Node<'a>;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

struct DefaultDocumentCleaner;

impl DocumentCleaner for DefaultDocumentCleaner {}

trait DocumentCleaner {
    fn clean_node_text(&self, node: Node) -> String {
        fn recur_text<T: DocumentCleaner + ?Sized>(
            node: Node,
            txt: &mut String,
            cleaner: &T,
            mut classes: Vec<String>,
        ) -> bool {
            if cleaner.is_bad_node_name(node) {
                return false;
            }

            // maintain a hierarchy of classes
            classes.extend(extract_language_classes(node));

            let mut txt_added = false;
            if cleaner.is_good_node(node) {
                for child in node.children() {
                    if child.is(header()) {
                        let header_level = child
                            .name()
                            .and_then(|tag| tag.strip_prefix('h'))
                            .and_then(|level| level.parse::<usize>().ok())
                            .unwrap_or(1);
                        txt.push('\n');
                        txt.push('\n');
                        for _ in 0..header_level {
                            txt.push('#');
                        }
                        txt.push(' ');
                        txt.push_str(
                            child
                                .text()
                                .chars()
                                .filter(|c| c.is_ascii() && *c != '\n')
                                .collect::<String>()
                                .trim(),
                        );
                        txt.push('\n');
                        txt_added |= true;
                    } else if child.is(pre()) {
                        // extract language tag from `pre` class and all child classes
                        // that are `code` tagged
                        let child_classes = extract_language_classes(child)
                            .chain(
                                child
                                    .children()
                                    .filter(|c| c.is(code()))
                                    .flat_map(extract_language_classes),
                            )
                            .collect::<Vec<_>>();

                        let language = EXT_MAP
                            .keys()
                            .chain(PROPER_CASE_MAP.keys())
                            .find(|&k| child_classes.iter().chain(classes.iter()).any(|c| c == k));

                        txt.push_str("\n```");
                        if let Some(language) = language {
                            txt.push_str(language);
                        }
                        txt.push('\n');
                        txt.push_str(&child.text());
                        if !child.text().ends_with('\n') {
                            txt.push('\n');
                        }
                        txt.push_str("```\n");
                        txt_added |= true;
                    } else if child.is(link()) {
                        let link_text = child.text();

                        // check if this link is an anchor link, typically used to share permalinks to headers
                        if link_text.chars().count() == 1 {
                            txt_added |= false
                        } else {
                            let link_href = child.attr("href");
                            if !link_text.trim().is_empty() {
                                if let Some(href) = link_href {
                                    txt.push_str(&format!("[{}]({})", link_text.trim(), href));
                                } else {
                                    txt.push_str(&link_text);
                                }
                            }
                            txt_added |= true;
                        }
                    } else if child.is(code()) {
                        txt.push('`');
                        txt.push_str(&child.text());
                        txt.push('`');
                        txt_added |= true;
                    } else if child.is(Name("td")) {
                        txt.push_str(&child.text());
                        txt.push(';');
                        txt_added |= true;
                    } else if child.is(list()) {
                        txt.push('-');
                        txt.push(' ');
                        txt.push_str(&child.text());
                        txt_added |= true;
                    } else {
                        let mut a = String::new();
                        if recur_text(child, &mut a, cleaner, classes.clone()) {
                            txt.push_str(&a);
                            txt_added |= true;
                        } else if !cleaner.is_bad_node_name(child) {
                            txt.push_str(&child.text());
                            txt_added |= true;
                        }
                    }

                    if child.is(para()) {
                        txt.push('\n');
                    }
                }
            }
            txt_added
        }

        let mut txt = String::new();
        let classes = Vec::new();
        recur_text(node, &mut txt, self, classes);
        txt
    }

    fn is_good_node(&self, node: Node) -> bool {
        !has_bad_attr(node)
    }

    fn is_bad_node_name(&self, node: Node) -> bool {
        is_bad_node(node)
    }

    fn iter_clean_nodes<'a>(&'a self, node: Node<'a>) -> CleanNodeIter<'a, Self>
    where
        Self: Sized,
    {
        CleanNodeIter {
            cleaner: self,
            inner: node.descendants(),
        }
    }
}
struct CleanNodeIter<'a, T: DocumentCleaner> {
    cleaner: &'a T,
    inner: Descendants<'a>,
}

impl<'a, T: DocumentCleaner> Iterator for CleanNodeIter<'a, T> {
    type Item = Node<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        let node = self.inner.next()?;
        if self.cleaner.is_bad_node_name(node) || !self.cleaner.is_good_node(node) {
            // skip every node under this bad node
            for ignore in node.descendants() {
                let next = self.inner.next()?;
                if ignore.index() != next.index() {
                    return Some(next);
                }
            }
        }
        Some(node)
    }
}

fn has_bad_attr(node: Node) -> bool {
    for attr in ATTR_TO_CHECK.iter() {
        if let Some(id) = node.attr(attr) {
            if RE_BAD_NODES_ATTR.is_match(id) {
                return true;
            }
        }
    }
    false
}

fn is_bad_node(node: Node) -> bool {
    if let Some(n) = node.name() {
        BAD_NODE_NAMES.contains(&n)
    } else {
        false
    }
}

fn para() -> impl Predicate {
    Name("blockquote")
        .or(Name("dl"))
        .or(Name("div"))
        .or(Name("img"))
        .or(Name("ol"))
        .or(Name("p"))
        .or(Name("pre"))
        .or(Name("table"))
        .or(Name("tr"))
        .or(Name("thead"))
        .or(Name("ul"))
}

fn header() -> impl Predicate {
    Name("h1")
        .or(Name("h2"))
        .or(Name("h3"))
        .or(Name("h4"))
        .or(Name("h5"))
        .or(Name("h6"))
}

fn pre() -> impl Predicate {
    Name("pre")
}

fn code() -> impl Predicate {
    Name("code")
}

fn link() -> impl Predicate {
    Name("a")
}

fn list() -> impl Predicate {
    Name("li")
}

fn extract_language_classes(node: Node) -> impl Iterator<Item = String> + '_ {
    node.attr("class")
        .map(|s| s.split(' '))
        .into_iter()
        .flatten()
        .map(|s| {
            // some heuristic prefixes & suffixes to remove
            s.replace("language", "")
                .replace("source", "")
                .replace("highlight", "")
                .replace('-', "")
        })
}

impl FromStr for Language {
    type Err = Language;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "ar" | "arabic" => Ok(Language::Arabic),
            "ru" | "russian" => Ok(Language::Russian),
            "nl" | "dutch" => Ok(Language::Dutch),
            "de" | "german" => Ok(Language::German),
            "en" | "english" => Ok(Language::English),
            "es" | "spanish" => Ok(Language::Spanish),
            "fr" | "french" => Ok(Language::French),
            "he" | "hebrew" => Ok(Language::Hebrew),
            "it" | "italian" => Ok(Language::Italian),
            "ko" | "korean" => Ok(Language::Korean),
            "no" | "norwegian" => Ok(Language::Norwegian),
            "fa" | "persian" => Ok(Language::Persian),
            "pl" | "polish" => Ok(Language::Polish),
            "pt" | "portuguese" => Ok(Language::Portuguese),
            "sv" | "swedish" => Ok(Language::Swedish),
            "hu" | "hungarian" => Ok(Language::Hungarian),
            "fi" | "finnish" => Ok(Language::Finnish),
            "da" | "danish" => Ok(Language::Danish),
            "zh" | "chinese" => Ok(Language::Chinese),
            "id" | "indonesian" => Ok(Language::Indonesian),
            "vi" | "vietnamese" => Ok(Language::Vietnamese),
            "sw" | "swahili" => Ok(Language::Swahili),
            "tr" | "turkish" => Ok(Language::Turkish),
            "el" | "greek" => Ok(Language::Greek),
            "uk" | "ukrainian" => Ok(Language::Ukrainian),
            s => Err(Language::Other(s.to_string())),
        }
    }
}

#[derive(Debug, Clone)]
struct ArticleTextNode<'a> {
    inner: Node<'a>,
}

impl<'a> ArticleTextNode<'a> {
    fn new(inner: Node<'a>) -> Self {
        Self { inner }
    }

    fn clean_text(&self) -> String {
        DefaultDocumentCleaner.clean_node_text(self.inner)
    }
}

impl<'a> Deref for ArticleTextNode<'a> {
    type Target = Node<'a>;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

struct ArticleTextNodeExtractor;

impl ArticleTextNodeExtractor {
    const MINIMUM_STOPWORD_COUNT: usize = 5;
    const MAX_STEPSAWAY_FROM_NODE: usize = 3;

    fn article_body_predicate() -> for<'r, 's> fn(&'r Node<'s>) -> bool {
        |node| {
            for (k, v) in ARTICLE_BODY_ATTR.iter().cloned() {
                if Attr(k, v).matches(node) {
                    return true;
                }
            }
            false
        }
    }

    fn calculate_best_node(doc: &Document, lang: Language) -> Option<ArticleTextNode> {
        let mut starting_boost = 1.0;

        let mut common_best_nodes = doc.find(
            Name("article")
                .or(Name("main"))
                .or(Attr("id", "main"))
                .or(Attr("id", "content"))
                .or(Attr("id", "doc-content"))
                .or(Attr("id", "contents"))
                .or(Attr("class", "book-body")),
        );

        // heuristics for commonly occurring nodes with main content
        if let Some(main_tag) = common_best_nodes.next() {
            // if exactly one, say, article node was found, use it
            // else, the site may be misusing these tags
            if common_best_nodes.next().is_none() {
                return Some(ArticleTextNode::new(main_tag));
            }
        }

        let txt_nodes: Vec<_> = ArticleTextNodeExtractor::nodes_to_check(doc)
            .filter(|n| !ArticleTextNodeExtractor::is_high_link_density(n))
            .filter_map(|node| {
                if let Some(stats) = node
                    .children()
                    .find_map(|n| n.as_text())
                    .and_then(|txt| lang.stopword_count(txt))
                {
                    if stats > 2 {
                        return Some((node, stats));
                    }
                }
                None
            })
            .collect();

        let mut nodes_scores = HashMap::with_capacity(txt_nodes.len());

        let nodes_number = txt_nodes.len();
        let negative_scoring = 0.0;
        let bottom_negativescore_nodes = nodes_number as f64 * 0.25;

        for (i, (node, stats)) in txt_nodes.iter().enumerate() {
            let mut boost_score = 0.0;

            if ArticleTextNodeExtractor::is_boostable(node, lang.clone()) {
                boost_score = (1.0 / starting_boost) * 50.0;
                starting_boost += 1.0;
            }

            if nodes_number > 15 {
                let score = (nodes_number - i) as f64;
                if score <= bottom_negativescore_nodes {
                    let booster = bottom_negativescore_nodes - score;
                    boost_score = booster.powf(2.0) * -1.0;

                    let negscore = boost_score.abs() + negative_scoring;
                    if negscore > 40.0 {
                        boost_score = 5.0;
                    }
                }
            }

            let upscore = stats + boost_score as usize;

            if let Some(parent) = node.parent() {
                let (score, cnt) = nodes_scores
                    .entry(parent.index())
                    .or_insert((0usize, 0usize));
                *score += upscore;
                *cnt += 1;

                // also update additional parent levels

                if let Some(parent_parent) = parent.parent() {
                    let (score, cnt) = nodes_scores
                        .entry(parent_parent.index())
                        .or_insert((0usize, 0usize));
                    *cnt += 1;
                    *score += upscore / 2;

                    if let Some(parent_2) = parent_parent.parent() {
                        let (score, cnt) = nodes_scores
                            .entry(parent_2.index())
                            .or_insert((0usize, 0usize));
                        *cnt += 1;
                        *score += upscore / 3;
                    }
                }
            }
        }

        let mut index = nodes_scores.keys().cloned().next();
        let mut top_score = 0;
        for (idx, (score, _)) in nodes_scores {
            if score > top_score {
                top_score = score;
                index = Some(idx);
            }
        }

        index.map(|i| ArticleTextNode::new(Node::new(doc, i).unwrap()))
    }

    fn nodes_to_check(doc: &Document) -> impl Iterator<Item = Node> {
        TextNodeFind::new(doc)
    }

    fn is_boostable(node: &Node, lang: Language) -> bool {
        let mut steps_away = 0;
        while let Some(sibling) = node.prev().filter(|n| n.is(Name("p"))) {
            if steps_away >= ArticleTextNodeExtractor::MAX_STEPSAWAY_FROM_NODE {
                return false;
            }
            if let Some(stats) = sibling
                .children()
                .find_map(|n| n.as_text())
                .and_then(|txt| lang.stopword_count(txt))
            {
                if stats > ArticleTextNodeExtractor::MINIMUM_STOPWORD_COUNT {
                    return true;
                }
            }
            steps_away += 1;
        }
        false
    }

    fn is_high_link_density(node: &Node) -> bool {
        let links = node
            .find(Name("a"))
            .filter_map(|n| n.children().find_map(|n| n.as_text()));

        if let Some(words) = node.as_text().map(|s| s.split_whitespace()) {
            let words_number = words.count();
            if words_number == 0 {
                return true;
            }

            let (num_links, num_link_words) = links.fold((0usize, 0usize), |(links, sum), n| {
                (links + 1, sum + n.split_whitespace().count())
            });

            if num_links == 0 {
                return false;
            }

            let link_divisor = num_link_words as f64 / words_number as f64;
            let score = link_divisor * num_links as f64;

            score >= 1.0
        } else {
            links.count() > 0
        }
    }

    fn words(txt: &str) -> impl Iterator<Item = &str> {
        txt.split(|c: char| c.is_whitespace() || is_punctuation(c))
            .filter(|s| !s.is_empty())
    }
}

fn is_punctuation(c: char) -> bool {
    PUNCTUATION.contains(c)
}

struct TextNodeFind<'a> {
    document: &'a Document,
    next: usize,
}

impl<'a> TextNodeFind<'a> {
    fn is_text_node(node: &Node<'a>) -> bool {
        Name("p").or(Name("pre").or(Name("td"))).matches(node)
    }

    fn is_bad(node: &Node<'a>) -> bool {
        Name("figure")
            .or(Name("media"))
            .or(Name("aside"))
            .matches(node)
    }

    fn new(document: &'a Document) -> Self {
        Self { document, next: 0 }
    }
}

impl<'a> Iterator for TextNodeFind<'a> {
    type Item = Node<'a>;

    fn next(&mut self) -> Option<Node<'a>> {
        while self.next < self.document.nodes.len() {
            let node = self.document.nth(self.next).unwrap();
            self.next += 1;
            if Self::is_bad(&node) {
                self.next += node.descendants().count();
            }
            if Self::is_text_node(&node) {
                return Some(node);
            }
        }
        None
    }
}
