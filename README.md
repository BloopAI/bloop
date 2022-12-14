[![bloop logo](./.github/assets/bloop_github_logo_dark.png#gh-dark-mode-only)](https://bloop.ai)
[![bloop logo](./.github/assets/bloop_github_logo_light.png#gh-light-mode-only)](https://bloop.ai)

bloop is a fast code-search engine written in Rust and Typescript. Search both your local and remote
repositories with plain-text, regex and filtered queries.

## Features

- Super-fast code search
- Sync your local and GitHub repositories (support for more code hosts coming soon!)
- Search with regex queries
- Sophisticated query filters so you can narrow down your results
- Find functions, variables or traits with symbol search
- Precise code navigation (go-to-reference and go-to-definition) for 9 of the most popular languages

bloop stands on the shoulders of the Rust ecosystem. Our search indexing is powered by [Tantivy](https://github.com/quickwit-oss/tantivy) and our multi-platform app is built with [Tauri](https://github.com/tauri-apps/tauri).

![code search demo](https://assets.bloop.ai/short_gif_for_github_code.gif)

## Get Started

The simplest way to get started with bloop is to download the app from the [releases section](https://github.com/BloopAI/bloop/releases). For more information, follow the [guide](https://bloop.ai/docs/getting-started) on our site.

For instructions on how to build from source or run bloop from the command line, check out these pages:

- [Build bloop app from source](./apps/desktop/README.md)
- [Run bloop from the command line](./server/README.md)

## Contributing

We welcome contributions big and small! Before jumping in please read [our contributors guide](./CONTRIBUTING.md) and [our code of conduct](./CODE_OF_CONDUCT.md).

Here's how to find your way around the repo:

- `apps/desktop`: The Tauri app
- `server/bleep`: The Rust backend which contains the core search and navigation logic
- `client`: The React frontend

If you find a bug or have a feature request, [open an issue](https://github.com/BloopAI/bloop/issues)!

## Privacy

We store as little data as possible. Opting in now to send telemetry to bloop helps us identify bugs and make data-driven product decisions. This option sends us crash reports, logs and high level information about feature usage (so we can tell that a search was made, but we wouldn't be able to see the query or results). If you change your mind, you can always disable this later in Settings!

You can read our full privacy policy [here](https://bloop.ai/privacy).
