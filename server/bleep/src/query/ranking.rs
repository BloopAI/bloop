use std::time::SystemTime;

use tantivy::{
    collector::{ScoreSegmentTweaker, ScoreTweaker},
    fastfield::Column,
    DocId, Score,
};
use tantivy_columnar::{column_values::ColumnValues, BytesColumn};

use crate::indexes::file::File;

pub struct DocumentTweaker(pub File);
pub struct SegmentScorer {
    line_length: Column<f64>,
    lang: BytesColumn,
    last_commit: Column<u64>,
}

impl ScoreSegmentTweaker<Score> for SegmentScorer {
    fn score(&mut self, doc: DocId, mut score: Score) -> Score {
        // * 1000 if it's a language we understand
        let mut bytes = Vec::new();
        self.lang.ords().values_for_doc(doc).for_each(|ord| {
            self.lang.ord_to_bytes(ord, &mut bytes).unwrap();
        });
        score *= 1.0 + bytes.len().min(1) as f32 * 999.0;

        // Penalty for lines that are too long
        score /= self.line_length.values.get_val(doc).clamp(20.0, 1000.0) as f32;
        score /= SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .saturating_sub(self.last_commit.values.get_val(doc))
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
        let Self(file) = self;
        let schema = file.schema();
        let avg_line_length_field = schema.get_field_name(file.avg_line_length);
        let lang_field = schema.get_field_name(file.lang);
        let last_commit_unix_seconds_field = schema.get_field_name(file.last_commit_unix_seconds);
        Ok(SegmentScorer {
            line_length: segment_reader.fast_fields().f64(avg_line_length_field)?,
            lang: segment_reader.fast_fields().bytes(lang_field)?.unwrap(),
            last_commit: segment_reader
                .fast_fields()
                .u64(last_commit_unix_seconds_field)?,
        })
    }
}
