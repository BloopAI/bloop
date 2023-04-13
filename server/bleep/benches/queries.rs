use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};

use anyhow::Result;
use criterion::{BenchmarkId, Criterion};
use futures::{stream, StreamExt};
use serde::Deserialize;
use serde_json::json;
use tempdir::TempDir;

#[derive(Deserialize)]
struct Count {
    count: usize,
}

const CONCURRENT_WARMUP_REQUESTS: usize = 2;
const SOURCE_DIR: &str = "../../";

const ADDRESS: &str = "http://127.0.0.1:7878";
const QUERIES: &[&str] = &[
    r#"t"#,
    r#"so"#,
    r#"ようこそ"#,
    r#"/.*/"#,
    r#"/[a-z]{4}/"#,
    r#"/--[a-zA-Z]/"#,
    r#"/#[clap(short, long, default_value_t = \d{4})]/"#,
    r#"symbol:handle"#,
    r#"symbol:res case:ignore"#,
    r#"path:src/comp symbol:handle"#,
    r#"path:/(comp|state)/ symbol:/[a-z]{6}/ lang:rs"#,
    r#"(symbol:handle (lang:ts or lang:rs)) or (result lang:ts)"#,
    r#"async fn main"#,
    r#"/async.fn.main/"#,
    r#"/async....main/"#,
    r#"path:server"#,
    r#"repo:/blo.*/"#,
    r#"repo:/blo.*/ path:src (lang:tsx or lang:ts)"#,
];

async fn index(index_dir: &Path) -> Result<()> {
    let mut config: bleep::Configuration = serde_json::from_value(json!({
    "index_dir": index_dir,
    "source": {
        "directory": SOURCE_DIR
    },
    }))
    .unwrap();

    config.index_only = true;

    bleep::Application::initialize(bleep::Environment::server(), config, None, None)
        .await
        .unwrap()
        .run()
        .await
}

async fn start_server(index_dir: &Path) -> tokio::task::JoinHandle<anyhow::Result<()>> {
    let config: bleep::Configuration = serde_json::from_value(json!({
    "index_dir": index_dir,
    "source": {
        "directory": SOURCE_DIR
    },
    "disable_background": true
    }))
    .unwrap();

    let handle = tokio::spawn(
        bleep::Application::initialize(bleep::Environment::server(), config, None, None)
            .await
            .unwrap()
            .run(),
    );

    while reqwest::get(format!("{ADDRESS}/health")).await.is_err() {
        std::thread::sleep(Duration::from_millis(50));
    }

    handle
}

async fn setup(index_dir: &Path) -> Result<tokio::task::JoinHandle<anyhow::Result<()>>> {
    // delete and recreate index dir if it exists
    if fs::metadata(index_dir).is_ok() {
        fs::remove_dir_all(index_dir)?;
        fs::create_dir_all(index_dir)?;
    }
    println!("Indexing...");
    index(index_dir).await.unwrap();
    Ok(start_server(index_dir).await)
}

async fn warmup(client: &reqwest::Client) {
    println!("Warmup times:");
    println!("query,    time,   success,    num results ");

    let mut warmup = stream::iter(QUERIES)
        .map(|q| async move {
            let start = Instant::now();
            let resp = client
                .get(format!("{ADDRESS}/q"))
                .query(&[("q", q)])
                .send()
                .await;
            let time = Instant::now() - start;
            let ok = resp.is_ok();

            // Number of search results returned
            let count = match resp {
                Ok(r) => match r.json::<Count>().await {
                    Ok(c) => c.count,
                    _ => 0,
                },
                _ => 0,
            };

            println!("{q}, {time:?}, {ok}, {count}");
        })
        .buffer_unordered(CONCURRENT_WARMUP_REQUESTS);

    while (warmup.next().await).is_some() {
        continue;
    }
}

fn bench_all(c: &mut Criterion, rt: &tokio::runtime::Runtime, client: &reqwest::Client) {
    let mut group = c.benchmark_group("Latency for query: ");
    group.measurement_time(Duration::from_secs(10));

    for q in QUERIES {
        group.bench_with_input(BenchmarkId::new("", format!(" {q}")), &q, |b, q| {
            b.to_async(rt)
                .iter(|| client.get(format!("{ADDRESS}/q")).query(&[("q", q)]).send());
        });
    }
}

fn main() {
    let client = reqwest::Client::new();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let index_dir = TempDir::new("bleep").unwrap();
    let handle = rt
        .block_on(async {
            let handle = setup(index_dir.path()).await;
            warmup(&client).await;
            handle
        })
        .unwrap();

    let mut criterion = Criterion::default().configure_from_args();
    bench_all(&mut criterion, &rt, &client);
    criterion.final_summary();

    handle.abort();
}
