{pkgs ? import <nixpkgs> {}}: 
let
  flake = builtins.getFlake "github:NixOS/nixpkgs/nixos-22.05";
  inherit (flake.legacyPackages."${pkgs.system}") pkgsStatic;
in

pkgsStatic.universal-ctags.overrideAttrs (old: {
  nativeBuildInputs = old.nativeBuildInputs ++ [ pkgsStatic.pkg-config ];
})
