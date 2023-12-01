use std::collections::HashSet;

use anyhow::Result;
use tracing::instrument;

use crate::{
    agent::{
        exchange::{SearchStep, Update},
        Agent,
    },
    analytics::EventData,
    symbol::Symbol,
    webserver::intelligence::handle,
};

impl Agent {
    #[instrument(skip(self))]
    pub async fn symbol_search(&mut self, symbol: &String, path: &usize) -> Result<String> {
        let path =str::to_owned(self.paths().nth(path.clone()).expect("invalid path alias")); 

        self.update(Update::StartStep(SearchStep::Symbol {
            symbol: symbol.clone(),
            path: path,
            response: String::new(),
        }))
        .await?;

        let content = self.get_file_content(&path).await?.expect("file not found");

        let symbol = content.symbol_locations.list().into_iter().filter(|s| s.kind == symbol.clone()).take(1).collect::<Vec<Symbol>>();

        if symbol.is_empty(){

        }
        else{
            let symbol = symbol[0];
        }

        let reference = handle();
        let response = paths
            .iter()
            .map(|(alias, path)| format!("{}: {}", alias, path))
            .collect::<Vec<_>>()
            .join("\n");

        self.update(Update::ReplaceStep(SearchStep::Path {
            query: query.clone(),
            response: response.clone(),
        }))
        .await?;

        self.track_query(
            EventData::input_stage("path search")
                .with_payload("query", query)
                .with_payload("is_semantic", is_semantic)
                .with_payload("results", &paths)
                .with_payload("raw_prompt", &response),
        );

        Ok(response)
    }
}
