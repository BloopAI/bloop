# Server

A cargo workspace which contains `bleep`, the Rust package which powers bloop's search and code navigation. Note that it is currently _not_ possible to run conversational GPT-4 search from the command line (we're working on this). Calls to the `/api/answer` endpoint will return an error.

## Setup

### Install

Dependencies:
 - [`rust`](https://rustup.rs/)
 - `openssl`
 - `onnxruntime`

### Build

```bash
cargo build -p bleep --release
```

## Usage

To index and search all the repos in a directory (say, `/path/to/source`) run (from this repo's root dir):

```bash
$ cargo run -p bleep --release -- \
  --source-dir /path/to/dir
```

`bleep` will recursively scan `/path/to/source` for repositories and start indexing them. It will also start a webserver. The location of the search index can be specified with the `--index-dir` parameter. By default, it is stored in the system cache.

`bleep` periodically checks for changes to local and remote repos and automatically reindexes if a change is detected. Indexing and polling can be disabled by passing the `--disable-background` and `--disable-fsevents` flags.

The log level can be customized by setting the `BLOOP_LOG` env var.

### Sync GitHub

To sync GitHub repos, first create a [GitHub Client ID](https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app). Then call `bleep` with the `--github-client-id <token>` parameter.

### Query

With the server running you can start searching your code with regex search:

```
$ curl -v "localhost:7878/api/q?q=anyhow%20path:webserver%20repo:bloop" | jq
```

You can check which repos are indexed and their status:
```
$ curl -v "localhost:7878/api/repos/indexed" | jq
```

### Arguments

Run this to see the full list of arguments that `bleep` accepts:

```
cargo run -p bleep -- --help
```

## OpenAPI

You can view OpenAPI documentation (and railroad diagrams for the query language) [here](https://bloop-api-docs.vercel.app/). 

`bleep` uses [utoipa](https://github.com/juhaku/utoipa) to automatically generate an OpenAPI spec. To can manually access the OpenAPI spec with this endpoint:
```
$ curl "localhost:7878/api/api-doc/openapi.yaml"
```  
