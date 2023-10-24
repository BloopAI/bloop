mod logrotate;
mod remotes;

use logrotate::*;
pub(crate) use remotes::*;

use crate::Application;

fn single_threaded_executor<F: std::future::Future<Output = ()> + Send>(
    app: &Application,
    f: impl (FnOnce(Application) -> F) + Send + 'static,
) {
    let app = app.clone();
    std::thread::spawn(move || {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("failed to start background jobs")
            .block_on((f)(app));
    });
}

pub(crate) fn start_background_jobs(app: Application) {
    if !app.env.is_cloud_instance() {
        single_threaded_executor(&app, clear_disk_logs);
    }

    single_threaded_executor(&app, sync_github_status);
    single_threaded_executor(&app, check_repo_updates);
    single_threaded_executor(&app, log_and_branch_rotate);
}
