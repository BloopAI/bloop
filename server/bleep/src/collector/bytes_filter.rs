// a version of tantivy::collector::FilterCollector that works on byte fast fields

use tantivy::collector::{Collector, SegmentCollector};
use tantivy::schema::Field;
use tantivy::{Score, SegmentReader, TantivyError};

pub struct BytesFilterCollector<TCollector, TPredicate>
where
    TPredicate: 'static + Clone,
{
    field: Field,
    collector: TCollector,
    predicate: TPredicate,
}

impl<TCollector, TPredicate> BytesFilterCollector<TCollector, TPredicate>
where
    TCollector: Collector + Send + Sync,
    TPredicate: Fn(&[u8]) -> bool + Send + Sync + Clone,
{
    /// Create a new BytesFilterCollector.
    pub fn new(
        field: Field,
        predicate: TPredicate,
        collector: TCollector,
    ) -> BytesFilterCollector<TCollector, TPredicate> {
        BytesFilterCollector {
            field,
            predicate,
            collector,
        }
    }
}

impl<TCollector, TPredicate> Collector for BytesFilterCollector<TCollector, TPredicate>
where
    TCollector: Collector + Send + Sync,
    TPredicate: Fn(&[u8]) -> bool + Send + Sync + Clone,
{
    // That's the type of our result.
    // Our standard deviation will be a float.
    type Fruit = TCollector::Fruit;

    type Child = BytesFilterSegmentCollector<TCollector::Child, TPredicate>;

    fn for_segment(
        &self,
        segment_local_id: u32,
        segment_reader: &SegmentReader,
    ) -> tantivy::Result<BytesFilterSegmentCollector<TCollector::Child, TPredicate>> {
        let schema = segment_reader.schema();
        let field_entry = schema.get_field_entry(self.field);
        if !field_entry.is_fast() {
            return Err(TantivyError::SchemaError(format!(
                "Field {:?} is not a fast field.",
                field_entry.name()
            )));
        }

        let field_name = schema.get_field_name(self.field);
        let fast_field_reader = segment_reader.fast_fields().bytes(field_name)?.unwrap();

        let segment_collector = self
            .collector
            .for_segment(segment_local_id, segment_reader)?;

        Ok(BytesFilterSegmentCollector {
            fast_field_reader,
            segment_collector,
            predicate: self.predicate.clone(),
        })
    }

    fn requires_scoring(&self) -> bool {
        self.collector.requires_scoring()
    }

    fn merge_fruits(
        &self,
        segment_fruits: Vec<<TCollector::Child as SegmentCollector>::Fruit>,
    ) -> tantivy::Result<TCollector::Fruit> {
        self.collector.merge_fruits(segment_fruits)
    }
}

pub struct BytesFilterSegmentCollector<TSegmentCollector, TPredicate>
where
    TPredicate: 'static,
{
    fast_field_reader: tantivy_columnar::BytesColumn,
    segment_collector: TSegmentCollector,
    predicate: TPredicate,
}

impl<TSegmentCollector, TPredicate> SegmentCollector
    for BytesFilterSegmentCollector<TSegmentCollector, TPredicate>
where
    TSegmentCollector: SegmentCollector,
    TPredicate: 'static + Fn(&[u8]) -> bool + Send + Sync,
{
    type Fruit = TSegmentCollector::Fruit;

    fn collect(&mut self, doc: u32, score: Score) {
        let mut value = Vec::new();
        self.fast_field_reader
            .ords()
            .values_for_doc(doc)
            .for_each(|ord| {
                self.fast_field_reader
                    .ord_to_bytes(ord, &mut value)
                    .unwrap();
            });
        if (self.predicate)(&value) {
            self.segment_collector.collect(doc, score)
        }
    }

    fn harvest(self) -> <TSegmentCollector as SegmentCollector>::Fruit {
        self.segment_collector.harvest()
    }
}
