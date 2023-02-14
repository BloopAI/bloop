{
  description = "bloop";

  inputs = rec {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-22.11";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.flake-utils = flake-utils;
      inputs.nixpkgs = nixpkgs;
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
        pkgsStatic = pkgs.pkgsStatic;
        lib = pkgs.lib;

        llvm = pkgs.llvmPackages_14;
        clang = llvm.clang;
        libclang = llvm.libclang;
        stdenv = llvm.stdenv;

        # Get a specific rust version
        rust = pkgs.rust-bin.stable.latest.default;
      in {
        devShell = pkgs.mkShell {
          shellHook = ''
            pnpm install >&2
          '';
          buildInputs = with pkgs;
            ([
              rust
              sccache
              git-lfs
              stdenv
              libclang
              clang
              rustup
              nodePackages.pnpm
              pkg-config
              openssl
              glib.dev
              cmake
              python3
              protobuf
              automake
              autoconf
              rocksdb
              universal-ctags
            ] ++ lib.optionals pkgs.stdenv.isLinux [
              dbus.dev
              libsoup.dev
              gtk3.dev
              webkitgtk
              dmidecode
              appimage-run
              appimagekit
            ] ++ lib.optionals pkgs.stdenv.isDarwin [
              darwin.apple_sdk.frameworks.Carbon
              darwin.apple_sdk.frameworks.WebKit
              darwin.apple_sdk.frameworks.AppKit
            ]);

          SCCACHE_DIR = "/Users/user/Code/bloop/bloop/sccache";
          RUSTC_WRAPPER = "${pkgs.sccache}/bin/sccache";
          ROCKSDB_LIB_DIR = "${pkgs.rocksdb}/lib";
          ROCKSDB_INCLUDE_DIR = "${pkgs.rocksdb}/include";
          LIBCLANG_PATH = "${libclang.lib}/lib";
        };

        packages.my-ctags = pkgsStatic.universal-ctags.overrideAttrs (old: {
          nativeBuildInputs = old.nativeBuildInputs
            ++ [ pkgsStatic.pkg-config ];
        });
      });
}

