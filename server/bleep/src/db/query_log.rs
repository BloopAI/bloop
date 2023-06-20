use chrono::{DateTime, Utc};

pub struct QueryLog<'a> {
    db: &'a super::SqlitePool,
}

impl<'a> QueryLog<'a> {
    pub fn new(db: &'a super::SqlitePool) -> Self {
        Self { db }
    }

    pub async fn insert(&self, raw: &str) -> anyhow::Result<()> {
        sqlx::query!("INSERT INTO query_log (raw_query) VALUES (?)", raw)
            .execute(self.db)
            .await?;

        Ok(())
    }

    pub async fn since(&self, cutoff: DateTime<Utc>) -> anyhow::Result<Vec<String>> {
        let recs = sqlx::query!(
            "SELECT raw_query FROM query_log \
		      WHERE created_at > ?",
            cutoff
        )
        .fetch_all(self.db)
        .await?;

        Ok(recs.into_iter().map(|r| r.raw_query).collect())
    }

    pub async fn prune(&self, cutoff: DateTime<Utc>) -> anyhow::Result<()> {
        sqlx::query!("DELETE FROM query_log WHERE created_at < ?", cutoff)
            .execute(self.db)
            .await?;

        Ok(())
    }
}
