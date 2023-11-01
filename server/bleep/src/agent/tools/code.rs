use anyhow::Result;
use tracing::{debug, info, instrument, trace};

use crate::{
    agent::{
        exchange::{CodeChunk, SearchStep, Update},
        prompts, Agent,
    },
    analytics::EventData,
    llm_gateway,
};

impl Agent {
    #[instrument(skip(self))]
    pub async fn code_search(&mut self, query: &String) -> Result<String> {
        const CODE_SEARCH_LIMIT: u64 = 10;
        const MINIMUM_RESULTS: usize = CODE_SEARCH_LIMIT as usize / 2;

        self.update(Update::StartStep(SearchStep::Code {
            query: query.clone(),
            response: String::new(),
        }))
        .await?;

        let mut results = self
            .semantic_search(query.into(), vec![], CODE_SEARCH_LIMIT, 0, 0.1, true)
            .await?;

        debug!("returned {} results", results.len());

        let hyde_docs = if results.len() < MINIMUM_RESULTS {
            info!("too few results returned, running HyDE");

            let hyde_docs = self.hyde(query).await?;
            if !hyde_docs.is_empty() {
                let hyde_doc = hyde_docs.first().unwrap().into();
                let hyde_results = self
                    .semantic_search(hyde_doc, vec![], CODE_SEARCH_LIMIT, 0, 0.3, true)
                    .await?;

                debug!("returned {} HyDE results", results.len());
                results.extend(hyde_results);
            }
            hyde_docs
        } else {
            vec![]
        };

        let mut chunks = results
            .into_iter()
            .map(|chunk| {
                let relative_path = chunk.relative_path;

                CodeChunk {
                    path: relative_path.clone(),
                    alias: self.get_path_alias(&relative_path),
                    snippet: chunk.text,
                    start_line: chunk.start_line as usize,
                    end_line: chunk.end_line as usize,
                }
            })
            .collect::<Vec<_>>();

        chunks.sort_by(|a, b| a.alias.cmp(&b.alias).then(a.start_line.cmp(&b.start_line)));

        for chunk in chunks.iter().filter(|c| !c.is_empty()) {
            self.exchanges
                .last_mut()
                .unwrap()
                .code_chunks
                .push(chunk.clone())
        }

        let response = chunks
            .iter()
            .filter(|c| !c.is_empty())
            .map(|c| c.to_string())
            .collect::<Vec<_>>()
            .join("\n\n");

        self.update(Update::ReplaceStep(SearchStep::Code {
            query: query.clone(),
            response: response.clone(),
        }))
        .await?;

        self.track_query(
            EventData::input_stage("semantic code search")
                .with_payload("query", query)
                .with_payload("hyde_queries", &hyde_docs)
                .with_payload("chunks", &chunks)
                .with_payload("raw_prompt", &response),
        );

        Ok(response)
    }

    /// Hypothetical Document Embedding (HyDE): https://arxiv.org/abs/2212.10496
    ///
    /// This method generates synthetic documents based on the query. These are then
    /// parsed and code is extracted. This has been shown to improve semantic search recall.
    async fn hyde(&self, query: &str) -> Result<Vec<String>> {
        let prompt = vec![llm_gateway::api::Message::system(
            &prompts::hypothetical_document_prompt(query),
        )];

        trace!(?query, "generating hyde docs");

        let response = self
            .llm_gateway
            .clone()
            .model("gpt-3.5-turbo-0613")
            .chat(&prompt, None)
            .await?;

        trace!("parsing hyde response");

        let documents = prompts::try_parse_hypothetical_documents(&response);

        for doc in documents.iter() {
            info!(?doc, "got hyde doc");
        }

        Ok(documents)
    }
}
