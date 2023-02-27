{
  description = "bloop";

  inputs = rec {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
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

        rust = pkgs.rust-bin.stable.latest.default;
        rustPlatform = pkgs.makeRustPlatform {
          cargo = rust;
          rustc = rust;
        };

        runtimeDeps = with pkgs;
          ([ openssl rocksdb universal-ctags git zlib ]
            ++ lib.optionals pkgs.stdenv.isLinux [ onnxruntime ]);

        buildDeps = with pkgs;
          ([
            git
            perl
            clang
            stdenv.cc.cc.lib
            rust
            rustup
            nodePackages.pnpm
            pkg-config
            cacert
            openssl
            openssl.dev
            glib.dev
            cmake
            python3
            protobuf
            automake
            autoconf
          ] ++ lib.optionals pkgs.stdenv.isDarwin [
            darwin.apple_sdk.frameworks.Foundation
            darwin.apple_sdk.frameworks.CoreFoundation
            darwin.apple_sdk.frameworks.Security
          ]);

        guiDeps = with pkgs;
          (lib.optionals pkgs.stdenv.isLinux [
            zlib.dev
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

        envVars = {
          ROCKSDB_LIB_DIR = "${pkgs.rocksdb}/lib";
          ROCKSDB_INCLUDE_DIR = "${pkgs.rocksdb}/include";
          LIBCLANG_PATH = "${libclang.lib}/lib";
          PYTHON = "${pkgs.python3}/bin/python3";
          ORT_LIB_LOCATION = "${onnxruntime-static}/lib";
        };

        bleep = (rustPlatform.buildRustPackage {
          meta = with pkgs.lib; {
            description = "Search code. Fast.";
            homepage = "https://bloop.ai";
            license = licenses.asl20;
            platforms = platforms.all;
          };

          name = "bleep";
          pname = "bleep";
          src = pkgs.lib.sources.cleanSource ./.;

          buildNoDefaultFeatures = true;
          buildFeatures = [ "dynamic-ort" ];

          cargoBuildFlags = "-p bleep";
          doCheck = false;

          cargoLock = {
            lockFile = ./Cargo.lock;
            outputHashes = {
              "hyperpolyglot-0.1.7" =
                "sha256-NftH6P+DmT2hggFxpBmvyekA/lv/JhbCJY8iMABhHp8=";
              "octocrab-0.17.0" =
                "sha256-UoHqwsOhfx5VBrK6z94Jk5aKpCxswcSBhiCNZAyq5a8=";
              "tree-sitter-cpp-0.20.0" =
                "sha256-h6mJdmQzJlxYIcY+d5IiaFghraUgBGZwqFPKwB3E4pQ=";
              "tree-sitter-go-0.19.1" =
                "sha256-f885YTswEDH/QfRPUxcLp/1E2zXLKl25R9IyTGKb1eM=";
              "tree-sitter-java-0.20.0" =
                "sha256-gQzoWGV9wYiLibMFkLoY2sdEJg+ae9NnHt/GFfFzP8U=";
              "ort-1.14.0-beta.0" =
                "sha256-gG6Mv+7rNunurKSk53zMajqChZcNt9awhmQOqo+dsVM=";
            };
          };

          nativeBuildInputs = buildDeps;
          buildInputs = runtimeDeps;
        }).overrideAttrs (old: envVars);

        onnxruntime-static = stdenv.mkDerivation rec {
          name = "onnxruntime-static";
          src = pkgs.fetchgit {
            url = "https://github.com/microsoft/onnxruntime";
            branchName = "v1.14.0";
            fetchSubmodules = true;
            sha256 = "sha256-UFdym5DYLGbfeslw9xZwe9mdwMJl5jfk2WIctO77jC8=";
          };

          phases = [ "unpackPhase" "buildPhase" "installPhase" ];

          buildPhase = ''
            python3 tools/ci_build/build.py --build --build_dir=build --update --parallel --skip_tests --skip_submodule_sync --disable_rtti --config Release
          '';

          installPhase = ''
            mkdir -p $out/lib
            find build/Release \( -name \*.a -o -name \*.so \) -exec cp --parents \{\} $out/lib \;
          '';

          nativeBuildInputs = with pkgs;
            [ cmake cacert python3 clang ] ++ lib.optionals pkgs.stdenv.isDarwin
            [ darwin.apple_sdk.frameworks.Foundation ];
        };
      in {
        packages = {
          bleep = bleep;
          onnxruntime-static = onnxruntime-static;
          default = bleep;
          docker = pkgs.dockerTools.buildImage {
            name = "bleep";
            config = { Cmd = [ "${bleep}/bin/bleep" ]; };
            extraCommands = ''
              ln -s ${bleep}/bin/bleep /bleep
            '';

          };

          my-ctags = pkgsStatic.universal-ctags.overrideAttrs (old: {
            nativeBuildInputs = old.nativeBuildInputs
              ++ [ pkgsStatic.pkg-config ];
          });
        };

        devShell = (pkgs.mkShell {
          shellHook = ''
            pnpm install >&2
          '';
          buildInputs = buildDeps ++ runtimeDeps ++ guiDeps
            ++ (with pkgs; [ git-lfs ]);
        }).overrideAttrs (old: envVars);

      });
}

