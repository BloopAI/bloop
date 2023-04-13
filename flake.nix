{
  description = "bloop";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        pkgsStatic = pkgs.pkgsStatic;
        lib = pkgs.lib;

        llvm = pkgs.llvmPackages_14;
        clang = llvm.clang;
        libclang = llvm.libclang;
        stdenv = llvm.stdenv;

        rustPlatform = pkgs.makeRustPlatform {
          cargo = pkgs.cargo;
          rustc = pkgs.rustc;
        };

        runtimeDeps =
          with pkgs; ([ openssl_1_1.out rocksdb git zlib ]);

        buildDeps = with pkgs;
          ([
            stdenv.cc.cc.lib
            glib.dev
            pkg-config
            openssl_1_1.out
            openssl_1_1.dev

            protobuf
            onnxruntime-static
          ] ++ lib.optionals stdenv.isDarwin [
            darwin.apple_sdk.frameworks.Foundation
            darwin.apple_sdk.frameworks.CoreFoundation
            darwin.apple_sdk.frameworks.Security
          ]);

        guiDeps = with pkgs;
          [ nodePackages.npm nodejs ] ++ (lib.optionals stdenv.isLinux [
            zlib.dev
            dbus.dev
            libsoup.dev
            gtk3.dev
            webkitgtk
            dmidecode
            appimage-run
            appimagekit
          ] ++ lib.optionals stdenv.isDarwin [
            darwin.apple_sdk.frameworks.Carbon
            darwin.apple_sdk.frameworks.WebKit
            darwin.apple_sdk.frameworks.AppKit
          ]);

        envVars = {
          LIBCLANG_PATH = "${libclang.lib}/lib";
          ROCKSDB_LIB_DIR = "${pkgs.rocksdb}/lib";
          ROCKSDB_INCLUDE_DIR = "${pkgs.rocksdb}/include";
          OPENSSL_LIB_DIR = "${pkgs.openssl_1_1.out}/lib";
          OPENSSL_INCLUDE_DIR = "${pkgs.openssl_1_1.dev}/include";
          OPENSSL_NO_VENDOR = "1";
          ORT_LIB_LOCATION = "${onnxruntime-static}/build";
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
                "sha256-GLwCOtYOvJWg/tBAuqVqwREaxlxAhL1FJltwF+fWROk=";
            };
          };

          nativeBuildInputs = buildDeps;
          buildInputs = runtimeDeps;
        }).overrideAttrs (old: envVars);

        onnxruntime-static =
          import ./nix/onnxruntime.nix { inherit pkgs stdenv; };

      in {
        packages = {
          bleep = bleep;

          default = bleep;
          docker = pkgs.dockerTools.buildImage {
            name = "bleep";
            config = { Cmd = [ "${bleep}/bin/bleep" ]; };
            extraCommands = ''
              ln -s ${bleep}/bin/bleep /bleep
            '';

          };

          onnxruntime-static = onnxruntime-static;
        };

        devShell = (pkgs.mkShell {
          buildInputs = buildDeps ++ runtimeDeps ++ guiDeps
            ++ (with pkgs; [ git-lfs cargo rustc rustfmt clippy ]);
        }).overrideAttrs (old: envVars);

      });
}

