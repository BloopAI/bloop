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
          ([ openssl_1_1.out rocksdb universal-ctags git zlib ]
            ++ lib.optionals pkgs.stdenv.isLinux [ onnxruntime ]);

        buildDeps = with pkgs;
          ([
            stdenv.cc.cc.lib
            glib.dev
            pkg-config
            openssl_1_1.out
            openssl_1_1.dev

            rust

            protobuf
            onnxruntime-static
          ] ++ lib.optionals pkgs.stdenv.isDarwin [
            darwin.apple_sdk.frameworks.Foundation
            darwin.apple_sdk.frameworks.CoreFoundation
            darwin.apple_sdk.frameworks.Security
          ]);

        guiDeps = with pkgs; [ nodePackages.pnpm] ++
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
          LIBCLANG_PATH = "${libclang.lib}/lib";
          ROCKSDB_LIB_DIR = "${pkgs.rocksdb}/lib";
          ROCKSDB_INCLUDE_DIR = "${pkgs.rocksdb}/include";
          OPENSSL_LIB_DIR = "${pkgs.openssl_1_1.out}/lib";
          OPENSSL_INCLUDE_DIR = "${pkgs.openssl_1_1.dev}/include";
          OPENSSL_NO_VENDOR = "1";
          ORT_LIB_LOCATION = "${onnxruntime-static}/build";
        };

        my-ctags = pkgsStatic.universal-ctags.overrideAttrs (old: {
            nativeBuildInputs = old.nativeBuildInputs
              ++ [ pkgsStatic.pkg-config ];
          });

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

        onnxruntime-static = stdenv.mkDerivation rec {
          pname = "onnxruntime";
          version = "1.14.0";

          src = pkgs.fetchFromGitHub {
            owner = "microsoft";
            repo = "onnxruntime";
            rev = "v${version}";
            sha256 = "sha256-Lm0AfUdr6EclNL/R3rPiA1o9qfsWH+f1Y0CX3JCFovo=";
            fetchSubmodules = true;
          };

          patches = [
            # Use dnnl from nixpkgs instead of submodules
            (pkgs.fetchpatch {
              name = "system-dnnl.patch";
              url =
                "https://aur.archlinux.org/cgit/aur.git/plain/system-dnnl.diff?h=python-onnxruntime&id=9c392fb542979981fe0026e0fe3cc361a5f00a36";
              sha256 = "sha256-+kedzJHLFU1vMbKO9cn8fr+9A5+IxIuiqzOfR2AfJ0k=";
            })
          ];

          howard-hinnant-date = pkgs.fetchFromGitHub {
            owner = "HowardHinnant";
            repo = "date";
            rev = "v2.4.1";
            sha256 = "sha256-BYL7wxsYRI45l8C3VwxYIIocn5TzJnBtU0UZ9pHwwZw=";
          };

          mp11 = pkgs.fetchFromGitHub {
            owner = "boostorg";
            repo = "mp11";
            rev = "boost-1.79.0";
            sha256 = "sha256-ZxgPDLvpISrjpEHKpLGBowRKGfSwTf6TBfJD18yw+LM=";
          };

          safeint = pkgs.fetchFromGitHub {
            owner = "dcleblanc";
            repo = "safeint";
            rev = "ff15c6ada150a5018c5ef2172401cb4529eac9c0";
            sha256 = "sha256-PK1ce4C0uCR4TzLFg+elZdSk5DdPCRhhwT3LvEwWnPU=";
          };

          pytorch_cpuinfo = pkgs.fetchFromGitHub {
            owner = "pytorch";
            repo = "cpuinfo";
            rev = "5916273f79a21551890fd3d56fc5375a78d1598d";
            sha256 = "sha256-nXBnloVTuB+AVX59VDU/Wc+Dsx94o92YQuHp3jowx2A=";
          };
          wil = pkgs.fetchFromGitHub {
            owner = "microsoft";
            repo = "wil";
            rev = "5f4caba4e7a9017816e47becdd918fcc872039ba";
            sha256 = "sha256-nbiDtBZsni7hp9fROBB1D4j7ssBZOgG5goeb6/lSS20=";
          };
          gsl = pkgs.fetchFromGitHub {
            owner = "microsoft";
            repo = "GSL";
            rev = "v4.0.0";
            sha256 = "sha256-cXDFqt2KgMFGfdh6NGE+JmP4R0Wm9LNHM0eIblYe6zU=";
          };

          flatbuffers = pkgs.fetchFromGitHub {
            owner = "google";
            repo = "flatbuffers";
            rev = "v1.12.0";
            sha256 = "sha256-L1B5Y/c897Jg9fGwT2J3+vaXsZ+lfXnskp8Gto1p/Tg=";
          };

          eigen = pkgs.fetchFromGitLab {
            owner = "libeigen";
            repo = "eigen";
            rev = "d10b27fe37736d2944630ecd7557cefa95cf87c9";
            sha256 = "sha256-Lmco0s9gIm9sIw7lCr5Iewye3RmrHEE4HLfyzRkQCm0=";
          };

          nativeBuildInputs = with pkgs; [ cmake pkg-config python3Packages.python ];

          buildInputs = with pkgs; [
            zlib
            howard-hinnant-date
            nlohmann_json
            boost
            oneDNN
            protobuf
            nsync
          ] ++ lib.optionals pkgs.stdenv.isDarwin
            [ darwin.apple_sdk.frameworks.Foundation ];

          checkInputs = [ ];

          # TODO: build server, and move .so's to lib output
          # Python's wheel is stored in a separate dist output
          outputs = [ "out" "dev" ];

          enableParallelBuilding = true;

          cmakeDir = "../cmake";

          cmakeFlags = with pkgs; [
            "-Donnxruntime_BUILD_SHARED_LIB=ON"
            "-Donnxruntime_ENABLE_LTO=ON"
            # Unit tests take considerable amount of build time
            "-Donnxruntime_BUILD_UNIT_TESTS=OFF"
            "-Donnxruntime_USE_MPI=ON"
            # DNNL/oneDNN is still a submodule
            "-Donnxruntime_USE_DNNL=OFF"

            "-DFETCHCONTENT_SOURCE_DIR_ABSEIL_CPP=${abseil-cpp_202206.src}"
            "-DFETCHCONTENT_SOURCE_DIR_DATE=${howard-hinnant-date}"
            "-DFETCHCONTENT_SOURCE_DIR_EIGEN=${eigen}"
            "-DFETCHCONTENT_SOURCE_DIR_FLATBUFFERS=${flatbuffers}"
            "-DFETCHCONTENT_SOURCE_DIR_GOOGLETEST=${gtest.src}"
            "-DFETCHCONTENT_SOURCE_DIR_GOOGLE_NSYNC=${nsync.src}"
            "-DFETCHCONTENT_SOURCE_DIR_GSL=${gsl}"
            "-DFETCHCONTENT_SOURCE_DIR_MICROSOFT_WIL=${wil}"
            "-DFETCHCONTENT_SOURCE_DIR_MP11=${mp11}"
            "-DFETCHCONTENT_SOURCE_DIR_NLOHMANN_JSON=${nlohmann_json.src}"
            "-DFETCHCONTENT_SOURCE_DIR_ONNX=${python3Packages.onnx.src}"
            "-DFETCHCONTENT_SOURCE_DIR_PROTOBUF=${protobuf.src}"
            "-DFETCHCONTENT_SOURCE_DIR_PYBIND11_PROJECT=${python3Packages.pybind11.src}"
            "-DFETCHCONTENT_SOURCE_DIR_PYTORCH_CPUINFO=${pytorch_cpuinfo}"
            "-DFETCHCONTENT_SOURCE_DIR_RE2=${re2.src}"
            "-DFETCHCONTENT_SOURCE_DIR_SAFEINT=${safeint}"
          ];

          doCheck = false;

          postPatch = ''
            substituteInPlace cmake/libonnxruntime.pc.cmake.in \
              --replace '$'{prefix}/@CMAKE_INSTALL_ @CMAKE_INSTALL_
          '';

          postBuild = null;

          postInstall = ''
            # perform parts of `tools/ci_build/github/linux/copy_strip_binary.sh`
            find .. \( -name \*.a -o -name \*.so -o -name \*.dylib \) -exec cp --parents \{\} $out/lib \;

            install -m644 -Dt $out/include \
              ../include/onnxruntime/core/framework/provider_options.h \
              ../include/onnxruntime/core/providers/cpu/cpu_provider_factory.h \
              ../include/onnxruntime/core/session/onnxruntime_*.h
          '';

          passthru = {
            protobuf = pkgs.protobuf;
          };
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

          my-ctags = my-ctags;
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

