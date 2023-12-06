use std::collections::HashSet;

use anyhow::Result;
use tracing::instrument;

use crate::{
    agent::{
        exchange::{SearchStep, Update},
        Agent,
    },
    analytics::EventData,
    intelligence::code_navigation::OccurrenceKind::{Definition, Reference},
    symbol::Symbol,
    webserver::intelligence::{inner_handle, TokenInfoRequest},
};

impl Agent {
    #[instrument(skip(self))]
    pub async fn symbol_search(&mut self, symbol: &String, path_idx: &usize) -> Result<String> {
        let path = str::to_owned(
            self.paths()
                .nth(path_idx.clone())
                .expect("invalid path alias"),
        );

        self.update(Update::StartStep(SearchStep::Symbol {
            symbol: symbol.clone(),
            path: path.clone(),
            response: String::new(),
        }))
        .await?;

        let content = self
            .get_file_content(&path.clone())
            .await?
            .expect("file not found");
        dbg!("{}", path.clone());
        //dbg!("{}", content.clone().symbol_locations.list().into_iter().map(|s| content.content[s.range.start.byte..s.range.end.byte].to_string()).collect::<Vec<_>>());

        //let graph = content.symbol_locations.scope_graph().unwrap().graph.clone();
        //dbg!("{}", graph.clone().node_indices().map(|i| content.content[graph[i].range().start.byte..graph[i].range().end.byte].to_string()).collect::<Vec<_>>());

        //let symbol_vec = graph.node_indices()
        //.filter(|&i| content.content[graph[i].range().start.byte..graph[i].range().end.byte] == symbol.clone())
        //.map(|i| graph[i].range()).take(1).collect::<Vec<_>>();
        //let range = symbol_vec.get(0).unwrap();

        let content_string = content.content;

        fn find_substring_bytes(main_string: &str, substring: &str) -> Option<(usize, usize)> {
            if let Some(start_idx) = main_string.find(substring) {
                let start_byte = main_string.as_bytes().iter().take(start_idx).count();
                let end_byte = start_byte + substring.len();
                Some((start_byte, end_byte))
            } else {
                None
            }
        }

        let range = find_substring_bytes(content_string.as_str(), symbol.as_str()).unwrap();

        let token_request = TokenInfoRequest {
            repo_ref: format!("github.com/{}", self.repo_ref.name.clone()),
            relative_path: path.clone(),
            start: range.0,
            end: range.1,
            branch: None,
        };

        dbg!("{}", &token_request);

        let token_response = inner_handle(token_request, self.app.indexes.clone())
            .await
            .unwrap();

        dbg!("{}", &token_response);

        let data_response = token_response.data;

        let response_def = data_response
            .iter()
            .filter(|x| {
                x.data.iter().any(|y| match y.kind {
                    Definition => true,
                    _ => false,
                })
            })
            .map(|x| format!("{}: {}", self.get_path_alias(x.file.as_str()), x.file))
            .collect::<Vec<_>>()
            .join("\n");

        let response_ref = data_response
            .iter()
            .filter(|x| {
                x.data.iter().any(|y| match y.kind {
                    Reference => true,
                    _ => false,
                })
            })
            .map(|x| format!("{}: {}", self.get_path_alias(x.file.as_str()), x.file))
            .collect::<Vec<_>>()
            .join("\n");

        let response = format!(
            "Definition:\n{}\n\nReferences:\n{}",
            response_def, response_ref
        );

        dbg!("{}", response.clone());

        self.update(Update::ReplaceStep(SearchStep::Symbol {
            symbol: symbol.clone(),
            path: path.clone(),
            response: response.clone(),
        }))
        .await?;

        Ok(response)
    }
}
