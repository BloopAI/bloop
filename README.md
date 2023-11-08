<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://assets.bloop.ai/bloop_github_logo_dark.png">
  <img alt="bloop logo" src="https://assets.bloop.ai/bloop_github_logo_light.png">
</picture>

bloop is ChatGPT for your code. Ask questions in natural language, search for code and generate patches using your existing codebase as context. 

Engineers are increasing their productivity by using bloop to:
- Explain how files or features work in simple language
- Write new features, using their code as context
- Understand how to use poorly documented open source libraries
- Pinpoint errors
- Ask questions about English language codebases in other languages
- Reduce code duplication by checking for existing functionality

https://github.com/BloopAI/bloop/assets/7957964/01db3ccb-4af0-49a0-92d6-5a9c42357a51

## Features

- GPT-4 based conversational search
- Code Studio, an LLM playground that uses your code as context
- Blazing fast regex search
- Sync your local and GitHub repositories (support for more code hosts coming soon!)
- Sophisticated query filters so you can narrow down your results
- Find functions, variables or traits with symbol search
- Precise code navigation (go-to-reference and go-to-definition) for 10+ of the most popular languages built with [Tree-sitter](https://tree-sitter.github.io/tree-sitter/)
- Privacy focussed on-device embedding for semantic search

bloop stands on the shoulders of the Rust ecosystem. Our search indexes are powered by [Tantivy](https://github.com/quickwit-oss/tantivy) and [Qdrant](https://github.com/qdrant/qdrant), and our multi-platform app is built with [Tauri](https://github.com/tauri-apps/tauri).

https://github.com/BloopAI/bloop/assets/7957964/93715188-d8d5-477b-8cd1-95d9cbd368cb

## Get Started

The simplest way to get started with bloop is to [download the app](https://github.com/BloopAI/bloop/releases) and follow the onboarding steps. Checkout our [getting started guide](https://bloop.ai/docs/getting-started) and our references for [conversational](https://bloop.ai/docs/natural-language-queries) and [regex](https://bloop.ai/docs/regex-queries) search and [Code Studio](https://bloop.ai/docs/code-studio).

For instructions on how to build from source or run bloop from the command line, check out these pages:

- [Build bloop app from source](./apps/desktop/README.md)
- [Run bloop from the command line](./server/README.md)

Note that it is currently _not_ possible to use conversational GPT-4 search where bloop has been built from source (we're working on this). You can run regex searches and use code-navigation.

If you encounter any index issues you can wipe the bloop cache and reindex. Instructions on how to do this on different platforms [are here](./apps/desktop/README.md).

## Contributing

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/BloopAI/bloop)

We welcome contributions big and small! Before jumping in please read [our contributors guide](./CONTRIBUTING.md) and [our code of conduct](./CODE_OF_CONDUCT.md).

Here's how to find your way around the repo:

- `apps/desktop`: The Tauri app
- `server/bleep`: The Rust backend which contains the core search and navigation logic
- `client`: The React frontend

We use Git LFS for dependencies that are expensive to build.

To make sure you have everything you need to start building, you'll need to
install the `git-lfs` package for your favourite operating system, then run the
following commands in this repo:

    git lfs install
    git lfs pull

If you find a bug or have a feature request, [open an issue](https://github.com/BloopAI/bloop/issues)! You can find the application logs here:

| OS      | Logs Path |
| ----------- | ----------- |
| MacOS      | `~/Library/Application\ Support/ai.bloop.bloop/bleep/logs`       |
| Windows   | `%APPDATA%/bloop/bleep/logs`        |
| Linux   | `~/.local/share/bloop/bleep/logs`        |

## Privacy

We store as little data as possible. We use telemetry to helps us identify bugs and make data-driven product decisions. You can read our full privacy policy [here](https://bloop.ai/privacy).

## License

Portions of this software are licensed as follows:

* All content that resides under the `server/bleep/src/ee/` directory of this repository, if that directory exists, is licensed under the license defined in [server/bleep/src/ee/LICENSE](./server/bleep/src/ee/LICENSE).
* All third party components incorporated into the bloop Software are licensed under the original license provided by the owner of the applicable component.
* Content outside of the above mentioned directories or restrictions above is available under the `Apache 2.0` license as defined in [LICENSE](./LICENSE).

