use tantivy::{
    collector::{Collector, SegmentCollector},
    schema::Field,
    DocAddress, Score, SegmentReader,
};
use tantivy_columnar;

use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct Group {
    pub items: Vec<DocAddress>,
}

#[derive(Debug)]
pub struct Groups {
    pub items: HashMap<blake3::Hash, Group>,
}

impl Groups {
    fn non_zero_count(self) -> Option<Self> {
        if self.items.len() == 0 {
            None
        } else {
            Some(self)
        }
    }
}

pub struct GroupCollector {
    field: Field,
    group_size: usize,
    limit: usize,
}

impl GroupCollector {
    pub fn with_field(field: Field) -> Self {
        Self {
            field,
            group_size: 1,
            limit: 100,
        }
    }

    pub fn with_group_size(self, group_size: usize) -> Self {
        Self { group_size, ..self }
    }

    pub fn with_limit(self, limit: usize) -> Self {
        Self { limit, ..self }
    }
}

impl Collector for GroupCollector {
    type Fruit = Option<Groups>;
    type Child = GroupSegmentCollector;

    fn for_segment(
        &self,
        segment_local_id: u32,
        segment_reader: &SegmentReader,
    ) -> tantivy::Result<GroupSegmentCollector> {
        let field_name = segment_reader.schema().get_field_name(self.field);
        let fast_field_reader = segment_reader.fast_fields().bytes(field_name)?.unwrap();
        Ok(GroupSegmentCollector {
            fast_field_reader,
            segment_local_id,
            group_size: self.group_size,
            groups: Groups {
                items: HashMap::new(),
            },
        })
    }

    fn requires_scoring(&self) -> bool {
        // this collector does not care about score.
        false
    }

    fn merge_fruits(&self, segment_groups: Vec<Option<Groups>>) -> tantivy::Result<Option<Groups>> {
        let mut groups = Groups {
            items: HashMap::new(),
        };

        for segment_group in segment_groups.into_iter().flatten() {
            // merge segment_group into groups
            let permitted_groups = self.limit.saturating_sub(groups.items.len());
            for (k, v) in segment_group.items.into_iter().take(permitted_groups) {
                groups
                    .items
                    .entry(k)
                    .and_modify(|entries| {
                        let permitted_items = self.group_size.saturating_sub(entries.items.len());
                        entries.items.extend(v.items.iter().take(permitted_items));
                    })
                    .or_insert_with(|| v);
            }
        }
        Ok(groups.non_zero_count())
    }
}

pub struct GroupSegmentCollector {
    fast_field_reader: tantivy_columnar::BytesColumn,
    segment_local_id: u32,
    groups: Groups,
    group_size: usize,
}

impl SegmentCollector for GroupSegmentCollector {
    type Fruit = Option<Groups>;

    fn collect(&mut self, doc: u32, _score: Score) {
        let mut value = Vec::new();
        self.fast_field_reader
            .ords()
            .values_for_doc(doc)
            .for_each(|ord| {
                self.fast_field_reader
                    .ord_to_bytes(ord, &mut value)
                    .unwrap();
            });
        let hash = {
            let mut h = blake3::Hasher::new();
            h.update(&value);
            h.finalize()
        };
        self.groups
            .items
            .entry(hash)
            .and_modify(|group| {
                // group.combined_score += score;
                if group.items.len() < self.group_size {
                    group
                        .items
                        .push(DocAddress::new(self.segment_local_id, doc))
                }
            })
            .or_insert_with(|| Group {
                // combined_score: score,
                items: vec![DocAddress::new(self.segment_local_id, doc)],
            });
    }

    fn harvest(self) -> <Self as SegmentCollector>::Fruit {
        self.groups.non_zero_count()
    }
}
