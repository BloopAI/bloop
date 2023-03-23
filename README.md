<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://assets.bloop.ai/bloop_github_logo_dark.png">
  <img alt="bloop logo" src="https://assets.bloop.ai/bloop_github_logo_light.png">
</picture>

bloop is a code-search engine that uses GPT-4 to answer questions about your code. Search both your local and remote repositories with natural language, regex and filtered queries.

## Features

- GPT-4 based conversational search
- Blazing fast regex search
- Sync your local and GitHub repositories (support for more code hosts coming soon!)
- Sophisticated query filters so you can narrow down your results
- Find functions, variables or traits with symbol search
- Precise code navigation (go-to-reference and go-to-definition) for 10+ of the most popular languages built with [Tree-sitter](https://tree-sitter.github.io/tree-sitter/)

bloop stands on the shoulders of the Rust ecosystem. Our search indexes are powered by [Tantivy](https://github.com/quickwit-oss/tantivy) and [Qdrant](https://github.com/qdrant/qdrant), and our multi-platform app is built with [Tauri](https://github.com/tauri-apps/tauri).

![code search demo](https://assets.bloop.ai/bloop_gpt4_short.gif)

## Get Started

The simplest way to get started with bloop is to [download the app](https://github.com/BloopAI/bloop/releases) and follow the onboarding steps. Checkout our [getting started guide](https://bloop.ai/docs/getting-started) and our references for [conversational](https://bloop.ai/docs/natural-language-queries) and [regex](https://bloop.ai/docs/regex-queries) search.

For instructions on how to build from source or run bloop from the command line, check out these pages:

- [Build bloop app from source](./apps/desktop/README.md)
- [Run bloop from the command line](./server/README.md)

Note that it is currently _not_ possible to run conversational GPT-4 search where bloop has been built from source (we're working on this). You can run regex searches and use code-navigation.

If you encounter any index issues you can wipe the bloop cache and reindex. Instructions on how to do this on different platforms [are here](./apps/desktop/README.md).

## Contributing

We welcome contributions big and small! Before jumping in please read [our contributors guide](./CONTRIBUTING.md) and [our code of conduct](./CODE_OF_CONDUCT.md).

Here's how to find your way around the repo:

- `apps/desktop`: The Tauri app
- `server/bleep`: The Rust backend which contains the core search and navigation logic
- `client`: The React frontend

We make extensive use of Git LFS for dependencies that are expensive to build.

To make sure you have everything you need to start building, you'll need to
install the `git-lfs` package for your favourite operating system, then run the
following commands in this repo:

    git lfs install
    git lfs pull

If you find a bug or have a feature request, [open an issue](https://github.com/BloopAI/bloop/issues)!

## Privacy

We store as little data as possible. Opting in now to send telemetry to bloop helps us identify bugs and make data-driven product decisions. This option sends us crash reports, logs and high level information about feature usage (so we can tell that a search was made, but we wouldn't be able to see the query or results). If you change your mind, you can always disable this later in Settings!

You can read our full privacy policy [here](https://bloop.ai/privacy).
