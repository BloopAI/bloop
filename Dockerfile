FROM rust AS builder
WORKDIR /build
COPY . ./
RUN cargo build --release -p bleep

FROM debian
RUN apt-get update && apt-get -y install universal-ctags openssl ca-certificates
COPY --from=builder /build/target/release/bleep /
ENTRYPOINT ["/bleep", "--host=0.0.0.0"]