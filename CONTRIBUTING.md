Guide to new contributors
=========================

Thanks for your interest in contributing to `bloop`!

Before jumping in, please
take a look at our [code of conduct](./CODE_OF_CONDUCT.md).

## Have a question?

If you have a question about using
[bloop](https://github.com/bloopai/bloop), please raise a ticket in
the repository, or say hi on our [Discord
server](https://discord.gg/kZEgj5pyjm).

## Would like to contribute?

If you have a great idea, some novel optimization, or a bug fix ready to be
merged, the maintainer team will help you get it into `bloop`.

We aim to maintain a high quality of contributions, and therefore all PRs need
to go through a review process. During the review period you may be asked to
make some changes to the code. When everybody's happy, we'll land the code, and
ship it in the next release!

After a longer period of inactivity, we will close PRs. Some of the code may
eventually make it into `bloop` if there's someone else to champion it, in
accordance with the license.

In case you are not certain that your code quality or the feature
you're working on is suitable for `bloop`, please open an issue
with the question, or send in the PR anyway.

This allows the maintainers to give you hands on feedback, and
work with you on specifics rather than theoretical proposals.

A quick list of things maintainers will check during review.
The following 2 steps are requirements for all PRs:

 * Don't break public APIs.
 * Make sure you use `rustfmt`, follow `clippy`, and check tests, or your PR will fail the CI!
 
Additionally, please pay attention to the following points as it helps
with our review. However, these are _not_ required:

 * Please follow one of the issue/PR templates to make our work easier.
 * Document your changes as best as you can where appropriate.
 * Take a look at surrounding code, and try to match the style.
 * If you implement new high-level features, make sure you have a minimal
   example either in the documentation or in form of tests/benchmarks.
 * If you have a short & sweet bug fix, please create a PR and
   describe instructions to reproduce the bug, or a negative unit test.
 * Provide tests for logic changes, and benchmarks for performance
   work if possible.
 
Following these points will help the maintainers to run through your
code and merge it in a timely manner.

Make sure the description of the PR clearly explains the motivation
and link to any other resources we might need to consider when
reviewing.

## Get in touch!

If you're still in doubt, email us at <maintainers@bloop.ai>, and we'll get you
started!
