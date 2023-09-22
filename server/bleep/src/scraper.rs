use anyhow::{anyhow, Result};
use select::predicate::Name;
use tokio::{sync::RwLock, task};
use tracing::{debug, error};
use url::Url;

use std::{
    collections::{HashMap, HashSet, VecDeque},
    path::PathBuf,
    sync::Arc,
};

mod article;
pub mod chunk;

use article::Article;

pub struct Scraper {
    pub queued_requests: Arc<RwLock<VecDeque<ScraperRequest>>>,
    pub handles: Vec<task::JoinHandle<Result<ScraperResult>>>,
    visited_links: HashSet<String>,
    config: Config,
}

impl Scraper {
    pub fn with_config(config: Config) -> Self {
        Self {
            queued_requests: Arc::new(RwLock::new(VecDeque::new())),
            handles: Vec::new(),
            visited_links: HashSet::new(),
            config,
        }
    }

    fn base_url(&self) -> &Url {
        &self.config.base_url
    }

    async fn queue_request(&self, req: ScraperRequest) {
        self.queued_requests.write().await.push_back(req);
    }

    async fn queue_requests(&self, reqs: impl Iterator<Item = ScraperRequest>) {
        self.queued_requests.write().await.extend(reqs);
    }

    fn active_tasks(&self) -> usize {
        self.handles.iter().filter(|h| !h.is_finished()).count()
    }

    fn is_permitted(&self, url: &Url) -> bool {
        url.as_str()
            .strip_prefix(self.base_url().as_str())
            .is_some()
    }

    fn finished_tasks(&mut self) -> Vec<task::JoinHandle<Result<ScraperResult>>> {
        let (finished, unfinished) = self.handles.drain(..).partition(|h| h.is_finished());
        self.handles = unfinished;
        finished
    }

    // maybe replace this with async-stream
    pub async fn complete(&mut self) -> Vec<Document> {
        let mut documents = vec![];

        self.queue_request(ScraperRequest {
            url: self.config.base_url.clone(),
            depth: 1,
        })
        .await;

        loop {
            // extract results from finished tasks
            for h in self.finished_tasks().into_iter() {
                debug!("task finished");
                match h.await {
                    Ok(Ok(mut scraper_result)) => {
                        documents.push(scraper_result.doc);
                        debug!("{} new urls collected", scraper_result.new_urls.len());

                        // there could be dupes among the new urls, collect them into a set first
                        let new_urls = scraper_result.new_urls.drain(..).fold(
                            HashMap::new(),
                            |mut map, (depth, url)| {
                                map.entry(url)
                                    .and_modify(|d| {
                                        *d = depth.min(*d);
                                    })
                                    .or_insert(depth);
                                map
                            },
                        );

                        self.queue_requests(
                            new_urls
                                .into_iter()
                                .filter(|(url, depth)| {
                                    *depth <= self.config.max_depth
                                        && !self.visited_links.contains(&url.to_string())
                                        && self.is_permitted(url)
                                })
                                .map(|(url, depth)| ScraperRequest { url, depth }),
                        )
                        .await;
                    }
                    Ok(Err(e)) => error!("task failed successfully: {e}"),
                    Err(e) => error!("task failed: {e}"),
                }
            }

            // add new tasks to queue if possible
            let active_tasks = self.active_tasks();
            if active_tasks <= self.config.max_concurrency {
                let new_task_count = (self.config.max_concurrency - active_tasks)
                    .min(self.queued_requests.read().await.len());
                let new_requests = self
                    .queued_requests
                    .write()
                    .await
                    .drain(..new_task_count)
                    .collect::<Vec<_>>(); // we collect here to drop the lock over the request queue

                for request in new_requests.into_iter() {
                    if !self.visited_links.contains(&request.url.to_string()) {
                        debug!("{} queued", request.url.as_str());
                        self.visited_links.insert(request.url.to_string());
                        let base_url = self.base_url().clone();
                        let handle = task::spawn(async { visit(request, base_url).await });
                        self.handles.push(handle);
                    }
                }
            }

            if self.queued_requests.read().await.is_empty() && self.handles.is_empty() {
                debug!("no more tasks");
                break;
            }
        }

        documents
    }
}

pub struct ScraperRequest {
    url: Url,
    depth: usize,
}

pub struct ScraperResult {
    doc: Document,
    new_urls: Vec<(usize, Url)>,
}

pub struct Config {
    max_depth: usize,
    base_url: Url,
    delay: std::time::Duration,
    max_concurrency: usize,
}

impl Config {
    pub fn new(base_url: Url) -> Self {
        Self {
            max_depth: 5,
            base_url,
            delay: std::time::Duration::from_millis(0),
            max_concurrency: std::thread::available_parallelism()
                .map(|t| t.get())
                .unwrap_or(4),
        }
    }
}

pub struct Document {
    pub url: Url,
    pub relative_url: String,
    pub path: PathBuf,
    pub content: String,
}

async fn visit(
    ScraperRequest { url, depth }: ScraperRequest,
    base_url: Url,
) -> Result<ScraperResult> {
    debug!("visited - {}", url);

    // calculate the location on disk to store this url
    let mut doc_path = PathBuf::from(url.path().strip_prefix('/').unwrap()); // infallible

    if !doc_path.ends_with("index.html") {
        doc_path.push("index.html");
    }

    // TODO stagger this request by config.delay
    // tokio::time::sleep(self.config.delay).await;

    // fetch and parse article
    let article = Article::builder(url.clone())?.get().await?;

    // scrape all relative links from this doc and add onto stack
    let html = article.doc;
    let new_urls = html
        .find(Name("a"))
        .filter_map(|l| l.attr("href"))
        .filter(|v| {
            match Url::parse(v) {
                Err(url::ParseError::RelativeUrlWithoutBase) => true, // we want only relative links
                _ => false,
            }
        })
        .filter_map(|new_path| base_url.join(new_path).ok())
        .map(|mut u| {
            u.set_fragment(None);
            (depth + 1, u)
        })
        .collect();
    // self.link_stack.extend(new_links);

    // build document
    let content = article
        .content
        .text
        .ok_or_else(|| anyhow!("unable to fetch article content"))?
        .to_string();

    let doc = Document {
        relative_url: base_url.make_relative(&url).unwrap(),
        url,
        path: doc_path,
        content,
    };

    Ok(ScraperResult { doc, new_urls })
}
