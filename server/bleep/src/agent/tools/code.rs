use anyhow::Result;
use tracing::{debug, info, trace};

use crate::{
    agent::{
        exchange::{CodeChunk, RepoPath, SearchStep, Update},
        prompts, Agent, AgentSemanticSearchParams,
    },
    llm,
    query::parser::Literal,
    semantic::SemanticSearchParams,
};

impl Agent {
    pub async fn code_search(&mut self, query: &str) -> Result<String> {
        const CODE_SEARCH_LIMIT: u64 = 10;
        const MINIMUM_RESULTS: usize = CODE_SEARCH_LIMIT as usize / 2;

        self.update(Update::StartStep(SearchStep::Code {
            query: query.to_owned(),
            response: String::new(),
        }))
        .await?;

        let relevant_repos = self.relevant_repos();

        let mut results = self
            .semantic_search(AgentSemanticSearchParams {
                query: Literal::from(&query.to_string()),
                paths: vec![],
                repos: relevant_repos.clone(),
                semantic_params: SemanticSearchParams {
                    limit: CODE_SEARCH_LIMIT,
                    offset: 0,
                    threshold: 0.3,
                    exact_match: false,
                },
            })
            .await?;

        debug!("returned {} results", results.len());

        if results.len() < MINIMUM_RESULTS {
            info!("too few results returned, running HyDE");

            let hyde_docs = self.hyde(query).await?;
            if !hyde_docs.is_empty() {
                let hyde_doc = hyde_docs.first().unwrap().into();
                let hyde_results = self
                    .semantic_search(AgentSemanticSearchParams {
                        query: hyde_doc,
                        paths: vec![],
                        repos: relevant_repos,
                        semantic_params: SemanticSearchParams {
                            limit: CODE_SEARCH_LIMIT,
                            offset: 0,
                            threshold: 0.3,
                            exact_match: false,
                        },
                    })
                    .await?;

                debug!("returned {} HyDE results", results.len());
                results.extend(hyde_results);
            }
        }

        let mut chunks = results
            .into_iter()
            .map(|chunk| {
                let repo = chunk.repo_ref;
                let path = chunk.relative_path;

                let repo_path = RepoPath {
                    repo,
                    path: path.clone(),
                };

                CodeChunk {
                    alias: self.get_path_alias(&repo_path),
                    snippet: chunk.text,
                    start_line: chunk.start_line as usize,
                    end_line: chunk.end_line as usize,
                    start_byte: Some(chunk.start_byte as usize),
                    end_byte: Some(chunk.end_byte as usize),
                    repo_path,
                }
            })
            .collect::<Vec<_>>();

        chunks.sort_by(|a, b| a.alias.cmp(&b.alias).then(a.start_line.cmp(&b.start_line)));

        for chunk in chunks.iter().filter(|c| !c.is_empty()) {
            self.conversation
                .exchanges
                .last_mut()
                .unwrap()
                .code_chunks
                .push(chunk.clone())
        }

        let extra_chunks = match self.get_related_chunks(chunks.clone()).await {
            Ok(chunks) => chunks,
            Err(e) => {
                info!(?e, "failed to get related chunks");
                vec![]
            }
        };

        chunks.extend(extra_chunks);

        let response = chunks
            .clone()
            .into_iter()
            .filter(|c| !c.is_empty())
            .map(|c| c.to_string())
            .collect::<Vec<_>>()
            .join("\n\n");

        self.update(Update::ReplaceStep(SearchStep::Code {
            query: query.to_string(),
            response: response.clone(),
        }))
        .await?;

        Ok(response)
    }

    /// Hypothetical Document Embedding (HyDE): https://arxiv.org/abs/2212.10496
    ///
    /// This method generates synthetic documents based on the query. These are then
    /// parsed and code is extracted. This has been shown to improve semantic search recall.
    async fn hyde(&self, query: &str) -> Result<Vec<String>> {
        let prompt = vec![llm::client::api::Message::system(
            &prompts::hypothetical_document_prompt(query),
        )];

        trace!(?query, "generating hyde docs");

        let response = self
            .llm_gateway
            .clone()
            .model("gpt-3.5-turbo-0613")
            .temperature(0.0)
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
