use std::collections::HashMap;
use std::ops::Range;

use levenshtein_automata::{Distance, LevenshteinAutomatonBuilder, DFA};
use once_cell::sync::Lazy;
use tantivy_fst::Automaton;

use tantivy::query::{AutomatonWeight, EnableScoring, Query, Weight};
use tantivy::schema::Term;
use tantivy::TantivyError::InvalidArgument;

pub(crate) struct DfaWrapper(pub DFA);

impl Automaton for DfaWrapper {
    type State = u32;

    fn start(&self) -> Self::State {
        self.0.initial_state()
    }

    fn is_match(&self, state: &Self::State) -> bool {
        match self.0.distance(*state) {
            Distance::Exact(_) => true,
            Distance::AtLeast(_) => false,
        }
    }

    fn can_match(&self, state: &u32) -> bool {
        *state != levenshtein_automata::SINK_STATE
    }

    fn accept(&self, state: &Self::State, byte: u8) -> Self::State {
        self.0.transition(*state, byte)
    }
}

/// A range of Levenshtein distances that we will build DFAs for our terms
/// The computation is exponential, so best keep it to low single digits
const VALID_LEVENSHTEIN_DISTANCE_RANGE: Range<u8> = 0..3;

static LEV_BUILDER: Lazy<HashMap<(u8, bool), LevenshteinAutomatonBuilder>> = Lazy::new(|| {
    let mut lev_builder_cache = HashMap::new();
    // TODO make population lazy on a `(distance, val)` basis
    for distance in VALID_LEVENSHTEIN_DISTANCE_RANGE {
        for &transposition in &[false, true] {
            let lev_automaton_builder = LevenshteinAutomatonBuilder::new(distance, transposition);
            lev_builder_cache.insert((distance, transposition), lev_automaton_builder);
        }
    }
    lev_builder_cache
});

/// A Fuzzy Query matches all of the documents
/// containing a specific term that is within
/// Levenshtein distance
/// ```rust
/// use tantivy::collector::{Count, TopDocs};
/// use tantivy::query::BytesFuzzyTermQuery ;
/// use tantivy::schema::{Schema, TEXT};
/// use tantivy::{doc, Index, Term};
///
/// fn example() -> tantivy::Result<()> {
///     let mut schema_builder = Schema::builder();
///     let title = schema_builder.add_text_field("title", TEXT);
///     let schema = schema_builder.build();
///     let index = Index::create_in_ram(schema);
///     {
///         let mut index_writer = index.writer(3_000_000)?;
///         index_writer.add_document(doc!(
///             title => "The Name of the Wind",
///         ))?;
///         index_writer.add_document(doc!(
///             title => "The Diary of Muadib",
///         ))?;
///         index_writer.add_document(doc!(
///             title => "A Dairy Cow",
///         ))?;
///         index_writer.add_document(doc!(
///             title => "The Diary of a Young Girl",
///         ))?;
///         index_writer.commit()?;
///     }
///     let reader = index.reader()?;
///     let searcher = reader.searcher();
///
///     {
///         let term = Term::from_field_text(title, "Diary");
///         let query = BytesFuzzyTermQuery ::new(term, 1, true);
///         let (top_docs, count) = searcher.search(&query, &(TopDocs::with_limit(2), Count)).unwrap();
///         assert_eq!(count, 2);
///         assert_eq!(top_docs.len(), 2);
///     }
///
///     Ok(())
/// }
/// # assert!(example().is_ok());
/// ```
#[derive(Debug, Clone)]
pub struct BytesFuzzyTermQuery {
    /// What term are we searching
    term: Term,
    /// How many changes are we going to allow
    distance: u8,
    /// Should a transposition cost 1 or 2?
    transposition_cost_one: bool,
    ///
    prefix: bool,
}

impl BytesFuzzyTermQuery {
    /// Creates a new Fuzzy Query
    pub fn new(term: Term, distance: u8, transposition_cost_one: bool) -> BytesFuzzyTermQuery {
        BytesFuzzyTermQuery {
            term,
            distance,
            transposition_cost_one,
            prefix: false,
        }
    }

    /// Creates a new Fuzzy Query of the Term prefix
    pub fn new_prefix(
        term: Term,
        distance: u8,
        transposition_cost_one: bool,
    ) -> BytesFuzzyTermQuery {
        BytesFuzzyTermQuery {
            term,
            distance,
            transposition_cost_one,
            prefix: true,
        }
    }

    fn specialized_weight(&self) -> tantivy::Result<AutomatonWeight<DfaWrapper>> {
        // LEV_BUILDER is a HashMap, whose `get` method returns an Option
        match LEV_BUILDER.get(&(self.distance, self.transposition_cost_one)) {
            // Unwrap the option and build the Ok(AutomatonWeight)
            Some(automaton_builder) => {
                let term_text_bytes = self.term.as_bytes().ok_or_else(|| {
                    InvalidArgument("The bytes fuzzy term query requires a bytes term.".to_string())
                })?;
                let term_text = std::str::from_utf8(term_text_bytes).map_err(|_| {
                    InvalidArgument("The bytes fuzzy term query requires valid utf8.".to_string())
                })?;
                let automaton = if self.prefix {
                    automaton_builder.build_prefix_dfa(term_text)
                } else {
                    automaton_builder.build_dfa(term_text)
                };
                Ok(AutomatonWeight::new(
                    self.term.field(),
                    DfaWrapper(automaton),
                ))
            }
            None => Err(InvalidArgument(format!(
                "Levenshtein distance of {} is not allowed. Choose a value in the {:?} range",
                self.distance, VALID_LEVENSHTEIN_DISTANCE_RANGE
            ))),
        }
    }
}

impl Query for BytesFuzzyTermQuery {
    fn weight(&self, _enable_scoring: EnableScoring<'_>) -> tantivy::Result<Box<dyn Weight>> {
        Ok(Box::new(self.specialized_weight()?))
    }
}
