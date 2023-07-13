FROM gitpod/workspace-nix:2023-05-09-03-02-39

ARG onetime_cache_dir="/tmp/.workdir"

RUN mkdir -p "${onetime_cache_dir}"
COPY --chown=gitpod:gitpod . "${onetime_cache_dir}"

# Cache nix compilation for saving time
WORKDIR "${onetime_cache_dir}"
SHELL [ "/bin/bash", "-c" ]
RUN source "$HOME/.nix-profile/etc/profile.d/nix.sh" \
    && nix run nixpkgs#cachix use bloopai \
    && nix develop
