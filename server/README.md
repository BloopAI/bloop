# Server

A cargo workspace which contains `bleep`, the Rust package which powers bloop's search and code navigation.

## Setup

### Install

Dependencies:
 - [`rust`](https://rustup.rs/)
 - `openssl`
 - `onnxruntime`
 - `universal-ctags`

Follow [these instructions](https://github.com/universal-ctags/ctags) and verify the installation with `ctags --version`. You should see something like this:

```
Universal Ctags 5.9.0(6f10588d), Copyright (C) 2015-2022 Universal Ctags Team
Universal Ctags is derived from Exuberant Ctags.
Exuberant Ctags 5.8, Copyright (C) 1996-2009 Darren Hiebert
  Compiled: Aug 19 2022, 11:23:10
  URL: https://ctags.io/
  Optional compiled features: +wildcards, +regex, +gnulib_fnmatch, +gnulib_regex, +iconv, +option-directory, +xpath, +json, +interactive, +yaml, +case-insensitive-filenames, +packcc, +optscript
```
Make sure that `+json` is in the list of compiled features.

### Natural Language Answers
To execute natural language queries `bleep` needs to connect to a instance of [Qdrant](https://github.com/qdrant/qdrant), a vector search database. You can start Qdrant on port 6334 (where `bleep` expects it by default) with:

```
docker run -p 6333:6333 -p 6334:6334 \
    -e QDRANT__SERVICE__GRPC_PORT="6334" \
    qdrant/qdrant
```

You can run `bleep` without linking it to a `Qdrant` instance but calls to the `/answer` endpoint will return an error.

You'll also need to run a local instance of `answer_api` (`bleep` expects it on port 7879 by default) which handles requests to the explanation API.

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

bloop will recursively scan `/path/to/source` for repositories and start indexing them. It will also start a webserver. The location of the search index can be specified with the `--index-dir` parameter. By default it is stored in the system cache.

bloop periodically checks for changes to local and remote repos and automatically reindexes if a change is detected. Indexing and polling can be disabled by passing the `--disable-background` and `--disable-fsevents` flags.

The log level can be customized by setting the `BLOOP_LOG` env var.

### Sync GitHub

To sync GitHub repos, first create a [GitHub Client ID](https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app). Then call bleep with the `--github-client-id <token>` parameter.

### Arguments

```bash
Options:
  -c, --config-file <CONFIG_FILE>
          If a config file is given, it will override _all_ command line parameters!
  -d, --source-dir <DIRECTORY>
          Directory where repositories are located
  -s, --state-file <STATE_FILE>
          State file for all repositories
      --credentials <CREDENTIALS>
          Credentials store for external providers
  -v, --version-file <VERSION_FILE>
          Version of the current schema
  -i, --index-dir <INDEX_DIR>
          Directory to store indexes [default: /Users/gabriel/Library/Caches/ai.bloop.bleep]
      --index-only
          Quit after indexing the specified repos
      --disable-background
          Disable periodic reindexing, and `git pull` on remote repositories
      --disable-fsevents
          Disable system-native notification backends to detect new git commits immediately
  -b, --buffer-size <BUFFER_SIZE>
          Size of memory to use for file indexes [default: 100000000]
  -r, --repo-buffer-size <REPO_BUFFER_SIZE>
          Size of memory to use for repo indexes [default: 30000000]
  -m, --max-threads <MAX_THREADS>
          Maximum number of parallel background threads [default: 8]
      --host <HOST>
          Bind the webserver to `<port>` [default: 127.0.0.1]
      --port <PORT>
          Bind the webserver to `<host>` [default: 7878]
      --qdrant-url <QDRANT_URL>
          URL for the qdrant server [default: http://127.0.0.1:6334]
      --answer-api-url <ANSWER_API_URL>
          URL for the answer-api [default: http://127.0.0.1:7879]
      --model-dir <MODEL_DIR>
          Path to the embedding model directory [default: model]
      --github-client-id <GITHUB_CLIENT_ID>
          Github Client ID for OAuth connection to private repos
      --segment-key <SEGMENT_KEY>
          Segment write key
      --max-chunk-tokens <MAX_CHUNK_TOKENS>
          Maximum number of tokens in a chunk (should be the model's input size) [default: 256]
      --overlap <OVERLAP>
          Chunking strategy [possible values: 1, 50%]
  -h, --help
          Print help information
  -V, --version
          Print version information
```

### Query

With the server running you can start searching your code:

```
$ curl -v "localhost:7878/q?q=anyhow%20path:webserver%20repo:bloop" | jq
```

You can get answers in natural language by querying the `answer` endpoint:

```
curl "localhost:7878/answer?q=what%20does%20the%20query%20parser%20do?"
```

You can check which repos are indexed and their status:
```
$ curl -v "localhost:7878/repos/indexed" | jq
```

## OpenAPI

You can view OpenAPI documentation (and railroad diagrams for the query language) [here](https://bloop-api-docs.vercel.app/). 

`bleep` uses [utoipa](https://github.com/juhaku/utoipa) to automatically generate an OpenAPI spec. To can manually access the OpenAPI spec with this endpoint:
```
$ curl "localhost:7878/api-doc/openapi.yaml"
```  