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
        libclang = llvm.libclang;
        stdenv = llvm.stdenv;

        # Get a specific rust version
        rust = pkgs.rust-bin.stable.latest.default;
        buildDeps = with pkgs;
          ([
            stdenv.cc.cc.lib
            rust
            git-lfs
            rustup
            nodePackages.pnpm
            pkg-config
            openssl
            openssl.dev
            glib.dev
            cmake
            python3
            protobuf
            automake
            autoconf
            universal-ctags
          ] ++ lib.optionals pkgs.stdenv.isLinux [
            perl
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

        buildEnv = {
          LIBCLANG_PATH = "${libclang.lib}/lib";
        };
      in rec {
        devShell = pkgs.mkShell ({
          shellHook = ''
            pnpm install >&2
          '';
          buildInputs = buildDeps;
        } // buildEnv);

        packages.my-ctags = pkgsStatic.universal-ctags.overrideAttrs (old: {
          nativeBuildInputs = old.nativeBuildInputs
            ++ [ pkgsStatic.pkg-config ];
        });
      });
}

