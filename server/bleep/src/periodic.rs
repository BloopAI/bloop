mod logrotate;
mod remotes;

use logrotate::*;
pub(crate) use remotes::*;

use crate::Application;

pub(crate) fn start_background_jobs(app: Application) {
    if !app.env.is_cloud_instance() {
        let app = app.clone();
        std::thread::spawn(move || {
            tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("failed to start background jobs")
                .block_on(clear_disk_logs(app.clone()));
        });
    }

    {
        let app = app.clone();
        std::thread::spawn(move || {
            tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("failed to start background jobs")
                .block_on(sync_github_status(app.clone()));
        });
    }

    {
        let app = app.clone();
        std::thread::spawn(move || {
            tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("failed to start background jobs")
                .block_on(check_repo_updates(app.clone()));
        });
    }

    {
        let app = app.clone();
        std::thread::spawn(move || {
            tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("failed to start background jobs")
                .block_on(log_and_branch_rotate(app.clone()));
        });
    }
}
