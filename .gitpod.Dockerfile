FROM gitpod/workspace-nix:latest

ARG onetime_cache_dir="/tmp/.workdir"

RUN mkdir -p "${onetime_cache_dir}"
COPY --chown=gitpod:gitpod . "${onetime_cache_dir}"

# Cache nix compilation for saving time
WORKDIR "${onetime_cache_dir}"
SHELL [ "/bin/bash", "-c" ]
RUN git lfs install --skip-smudge \
    && git lfs pull \
    && git lfs install --force \
    && source "$HOME/.nix-profile/etc/profile.d/nix.sh" \
    && nix develop
