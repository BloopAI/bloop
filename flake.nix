{
  description = "bloop";

  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-22.05";
  inputs.flake-utils.url = "github:numtide/flake-utils";
  inputs.flake-utils.inputs.nixpkgs.follows = "nixpkgs";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          pkgsStatic = pkgs.pkgsStatic;
        in
        {
          devShell = pkgs.mkShell {
            shellHook = ''
              rustup default stable >&2
              pnpm install >&2
            '';
            buildInputs = with pkgs; [
              llvmPackages_14.stdenv
              rustup
              nodePackages.pnpm
              appimage-run
              appimage-run-tests
              appimagekit
              dbus.dev
              pkg-config
              openssl
              glib.dev
              gtk3.dev
              libsoup.dev
              webkitgtk
              dmidecode
            ];
          };

          packages.my-ctags = pkgsStatic.universal-ctags.overrideAttrs (old: {
            nativeBuildInputs = old.nativeBuildInputs ++ [ pkgsStatic.pkg-config ];
          });
        }
      );
}

