use Feature::*;

pub(crate) enum Feature {
    /// Allow scanning any path on the system. This is dangerous!
    AnyPathScan = 1 << 0,

    /// Only allow scanning inside the directories in
    /// `app.config.source_dir`
    SafePathScan = 1 << 1,

    /// Require authorization to access API endpoints
    AuthorizationRequired = 1 << 2,

    /// Allow GitHub Device flow. This is useful for typically local
    /// installations
    GithubDeviceFlow = 1 << 3,

    /// Use GitHub App permission system scoped to a single
    /// installation. Cloud instances use this.
    GithubInstallation = 1 << 4,
}

#[rustfmt::skip]
#[derive(Debug, Clone, Copy)]
pub enum Environment {
    /// Safe API that's suitable for public use
    Server =
	GithubDeviceFlow as isize
	| SafePathScan as isize,

    /// Use a GitHub App installation to manage repositories and user access.
    ///
    /// Running the server in this environment makes use of a GitHub App in order to list and fetch
    /// repositories. Note that GitHub App installs for a user profile are not valid in this mode.
    ///
    /// Connecting properly to a GitHub App installation requires the following flags:
    ///
    /// - `--github-client-id`
    /// - `--github-client-secret`
    /// - `--github-app-id`
    /// - `--github-app-private-key`
    /// - `--github-app-install-id`
    /// - `--instance-domain`
    ///
    /// Users are authenticated by checking whether they belong to the organization which installed
    /// the GitHub App. All users belonging to the organization are able to see all repos that the
    /// installation was allowed to access.
    PrivateServer =
	GithubInstallation as isize
	| AuthorizationRequired as isize,

    /// Enables scanning arbitrary user-specified locations through a Web-endpoint.
    InsecureLocal =
	AnyPathScan as isize
	| GithubDeviceFlow as isize,
}

#[derive(Debug, Clone)]
pub(crate) struct RuntimeEnvironment(Environment);

impl RuntimeEnvironment {
    pub(crate) fn new(env: Environment) -> Self {
        Self(env)
    }

    pub(crate) fn allow(&self, f: Feature) -> bool {
        0 < self.0 as isize & f as isize
    }
}
