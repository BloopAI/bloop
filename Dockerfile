FROM node AS frontend

ARG SENTRY_AUTH_TOKEN
ARG SENTRY_RELEASE_VERSION

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY apps/ apps
COPY client/ client
COPY playwright.config.js .
RUN npm run build-web

FROM rust:slim-bookworm as builder
WORKDIR /build
RUN apt-get update && \
    apt-get -y install make clang libc-dev curl cmake python3 protobuf-compiler pkg-config libssl3 libssl-dev git && \
    apt-get -y clean && \
    curl -sLo sccache.tar.gz https://github.com/mozilla/sccache/releases/download/v0.3.3/sccache-v0.3.3-x86_64-unknown-linux-musl.tar.gz && \
    tar xzf sccache.tar.gz && \
    mv sccache-*/sccache /usr/bin/sccache
ENV RUSTC_WRAPPER="/usr/bin/sccache"
ENV PYTHON /usr/bin/python3
ENV CC /usr/bin/clang
ENV CXX /usr/bin/clang++
COPY server server
COPY apps/desktop/src-tauri apps/desktop/src-tauri
COPY Cargo.lock Cargo.toml .
RUN --mount=target=/root/.cache/sccache,type=cache --mount=target=/build/target,type=cache  \
    cargo --locked build -p bleep --release && \
    cp /build/target/release/bleep / && \
    sccache --show-stats

FROM debian:bookworm-slim
VOLUME ["/repos", "/data"]
RUN apt-get update && apt-get -y install openssl ca-certificates libprotobuf-lite32 && apt-get clean
COPY model /model
COPY --from=builder /bleep /
COPY --from=frontend /build/client/dist /frontend
ENTRYPOINT ["/bleep", "--host=0.0.0.0", "--source-dir=/repos", "--index-dir=/data", "--model-dir=/model"]
