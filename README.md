<h1 align="center"><b>bloop</b></h1>
<p align="center">Find code. Fast.
    <br />
    <i>MacOS</i> -
    <i>Linux</i> -
    <i>Windows</i>
<p>

bloop is a fast code-search engine written in Rust. Search both your local and remote
repositories with plain-text, regex and filtered queries.

## Features

- Super-fast code search
- Sync your local and GitHub repositories (support for more code hosts coming soon!)
- Search with regex queries
- Sophisticated query filters so you can narrow down your results
- Find functions, variables or traits with symbol search
- Precise code navigation (go-to-reference and go-to-definition) for 9 of the most popular languages

bloop stands on the shoulders of the Rust ecosystem. Our search indexing is powered by [Tantivy](https://github.com/quickwit-oss/tantivy) and our multi-platform app is built with [Tauri](https://github.com/tauri-apps/tauri).

## Get Started

The simplest way to get started with bloop is to [download the app]() and follow the onboarding steps.

For instructions on how to build from source or run bloop from the command line, check out these pages:
- [Build bloop from source]()
- [Run bloop from the command line]()

## Contributing

We welcome contributions big and small! Here's how to find your way around the repo:

- `apps/desktop`: The Tauri app
- `server/bleep`: The Rust backend which contains the core search and navigation logic
- `client`: The React frontend

If you find a bug or have a feature request, [open an issue]()!

## Privacy

Our aim is to store as little data as possible, whilst being able to identify bugs and make data-driven product decisions. Therefore all users are given the option to opt-in to telemetry during onboarding. This option sends us crash reports, logs and high level information about feature usage (so we can tell that a search was made, but we wouldn't be able to see the query or results).