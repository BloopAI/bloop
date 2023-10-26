use std::{sync::Arc, time::SystemTime};

use tantivy::{
    collector::{ScoreSegmentTweaker, ScoreTweaker},
    fastfield::{BytesFastFieldReader, Column},
    DocId, Score,
};

use crate::indexes::file::File;

pub struct DocumentTweaker(pub File);
pub struct SegmentScorer {
    line_length: Arc<dyn Column<f64>>,
    lang: BytesFastFieldReader,
    last_commit: Arc<dyn Column<u64>>,
}

impl ScoreSegmentTweaker<Score> for SegmentScorer {
    fn score(&mut self, doc: DocId, mut score: Score) -> Score {
        // * 1000 if it's a language we understand
        score *= 1.0 + self.lang.num_bytes(doc).min(1) as f32 * 999.0;

        // Penalty for lines that are too long
        score /= self.line_length.get_val(doc).clamp(20.0, 1000.0) as f32;
        score /= SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .saturating_sub(self.last_commit.get_val(doc))
            .min(5_000_000) as f32;

        score
    }
}

impl ScoreTweaker<Score> for DocumentTweaker {
    type Child = SegmentScorer;

    fn segment_tweaker(
        &self,
        segment_reader: &tantivy::SegmentReader,
    ) -> tantivy::Result<Self::Child> {
        let Self(schema) = self;
        Ok(SegmentScorer {
            line_length: segment_reader.fast_fields().f64(schema.avg_line_length)?,
            lang: segment_reader.fast_fields().bytes(schema.lang)?,
            last_commit: segment_reader
                .fast_fields()
                .u64(schema.last_commit_unix_seconds)?,
        })
    }
}
