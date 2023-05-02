use bleep::{snippet::Snipper, symbol::SymbolLocations};
use criterion::{black_box, criterion_group, criterion_main, Criterion};

const JS_SAMPLE: &str = include_str!("./js-sample.js");

pub fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("Snipper::all_for_doc - js-sample.js", |b| {
        let snipper = Snipper::default().context(1, 1);
        let doc = bleep::indexes::reader::ContentDocument {
            content: JS_SAMPLE.into(),
            lang: Some("JavaScript".into()),
            relative_path: "js-sample.js".into(),
            repo_ref: "/path/to/myRepo".into(),
            repo_name: "myRepo".into(),
            line_end_indices: JS_SAMPLE
                .match_indices('\n')
                .map(|(i, _)| i as u32)
                .collect(),
            symbol_locations: SymbolLocations::Empty,
            branches: None,
        };

        b.iter(|| snipper.all_for_doc(black_box("context"), black_box(&doc)));
    });
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
