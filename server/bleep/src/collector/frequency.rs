use std::collections::HashMap;

use tantivy::{
    collector::{Collector, SegmentCollector},
    fastfield::BytesFastFieldReader,
    schema::Field,
    Score, SegmentReader,
};

pub struct FrequencyCollector(pub Field);

impl Collector for FrequencyCollector {
    type Fruit = HashMap<Vec<u8>, usize>;

    type Child = FrequencySegmentCollector;

    fn for_segment(
        &self,
        _segment_local_id: u32,
        segment_reader: &SegmentReader,
    ) -> tantivy::Result<FrequencySegmentCollector> {
        let reader = segment_reader.fast_fields().bytes(self.0)?;
        Ok(FrequencySegmentCollector {
            reader,
            freqs: HashMap::new(),
        })
    }

    fn requires_scoring(&self) -> bool {
        // this collector does not care about score.
        false
    }

    fn merge_fruits(&self, segments: Vec<Self::Fruit>) -> tantivy::Result<Self::Fruit> {
        let mut freqs = HashMap::new();
        for segment in segments.into_iter() {
            for (k, v) in segment {
                freqs.entry(k).and_modify(|old| *old += v).or_insert(v);
            }
        }
        Ok(freqs)
    }
}

pub struct FrequencySegmentCollector {
    reader: BytesFastFieldReader,
    freqs: HashMap<Vec<u8>, usize>,
}

impl SegmentCollector for FrequencySegmentCollector {
    type Fruit = HashMap<Vec<u8>, usize>;

    fn collect(&mut self, doc: u32, _score: Score) {
        let k = self.reader.get_bytes(doc);
        self.freqs
            .entry(k.to_owned())
            .and_modify(|v| *v += 1)
            .or_insert(1);
    }

    fn harvest(self) -> <Self as SegmentCollector>::Fruit {
        self.freqs
    }
}
