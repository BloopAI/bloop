use bleep::{
    indexes::{reader::ContentReader, DocumentRead, File},
    intelligence::TreeSitterFile,
    semantic::Semantic,
    symbol::SymbolLocations,
    Application, Configuration, Environment,
};
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use serde_json::json;
use std::{path::Path, sync::Arc};
use tantivy::doc;
use tempdir::TempDir;

async fn get_symbols() -> SymbolLocations {
    let file = std::fs::read_to_string("./js-sample-big-symbols.js").unwrap();
    let scope_graph = TreeSitterFile::try_build(file.as_bytes(), "javascript")
        .and_then(TreeSitterFile::scope_graph)
        .unwrap();

    SymbolLocations::TreeSitter(scope_graph)
}

async fn index(index_dir: &Path) {
    let mut index_only = serde_json::from_value::<Configuration>(json!({
    "disable_background": true,
    "index_dir": index_dir,
    }))
    .unwrap();

    index_only.index_only = true;

    let app = Application::initialize(Environment::server(), index_only, None, None)
        .await
        .unwrap();
    app.run().await.unwrap();
}

pub fn criterion_benchmark(c: &mut Criterion) {
    let index_dir = TempDir::new("bleep").unwrap();
    let model_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("model");
    let (_app, file, symbols) = tokio::runtime::Runtime::new().unwrap().block_on(async {
        index(index_dir.path()).await;

        let app = Application::initialize(
            Environment::server(),
            serde_json::from_value::<Configuration>(json!({
            "disable_background": true,
            "index_dir": index_dir.path()
            }))
            .unwrap(),
            None,
            None,
        )
        .await
        .unwrap();

        let file = File::new(
            app.config.clone(),
            Some(
                Semantic::initialize(&model_dir, "http://127.0.0.1:6334", Arc::clone(&app.config))
                    .await
                    .unwrap(),
            ),
        );

        // Get the symbols for the `js-sample-big-symbols.js` file in this directory.
        let symbols = get_symbols().await;

        (app, file, symbols)
    });

    c.bench_function("indexes::File::read_doc", move |b| {
        b.iter_batched(
            || {
                doc! {
                    file.entry_disk_path => "js-sample-big-symbols.js",
                    file.repo_ref => "local//bloop",
                    file.repo_name => "bloop",
                    file.relative_path => "js-sample-big-symbols.js",
                    file.content => include_str!("./js-sample-big-symbols.js"),
                    file.line_end_indices => Vec::new(),
                    file.lang => &b"JavaScript"[..],
                    file.avg_line_length => 42.0,
                    file.last_commit_unix_seconds => 42.0,
                    file.symbol_locations => bincode::serialize(&symbols).unwrap(),
                }
            },
            |tantivy_doc| ContentReader.read_document(black_box(&file), black_box(tantivy_doc)),
            criterion::BatchSize::SmallInput,
        );
    });
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
