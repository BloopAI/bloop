import React, { useContext, useEffect, useMemo } from 'react';
import { Trans } from 'react-i18next';
import Button from '../../../components/Button';
import PageHeader from '../../../components/ResultsPageHeader';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { SyncStatus } from '../../../types/general';

type Props = {
  suggestions: string[];
  isRepo?: boolean;
  isFolder?: boolean;
  repo?: string;
  refetchRepo?: () => void;
};

const MAX_RETRIES = 2;
let n = 0;

const NoResults = ({
  suggestions,
  isRepo,
  isFolder,
  repo,
  refetchRepo,
}: Props) => {
  const { repositories } = useContext(RepositoriesContext);

  const repoState = useMemo(
    () =>
      repo
        ? repositories?.find(
            (r) => r.name === repo.replace(/^github\.com\//, ''),
          )?.sync_status
        : undefined,
    [repositories, repo],
  );

  useEffect(() => {
    if (
      repoState === SyncStatus.Done &&
      refetchRepo &&
      isRepo &&
      n < MAX_RETRIES
    ) {
      refetchRepo();
      n++;
    }
  }, [repoState]);

  const items = useMemo(
    () =>
      suggestions.map((s) => (
        <Button key={s} variant="secondary" size="small">
          {s}
        </Button>
      )),
    [suggestions],
  );
  return (
    <div className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content">
      {isRepo || isFolder ? (
        <div className="flex flex-col gap-4 select-none">
          <h4 className="text-label-title">
            <Trans>
              {isRepo
                ? 'Sorry, this repository is not ready for search'
                : 'The folder is empty'}
            </Trans>
          </h4>
          <p className="body-s text-label-muted">
            <Trans>
              {isRepo
                ? 'Wait for the repository to finish syncing and try again'
                : "We haven't found any files to index in this folder"}
            </Trans>
          </p>
        </div>
      ) : (
        <PageHeader
          resultsNumber={0}
          showCollapseControls={false}
          loading={false}
        />
      )}
      {!isRepo && !isFolder && (
        <div className="mt-13 select-none">
          <p className="body-s text-label-muted">
            <Trans>Suggested combinations</Trans>
          </p>
          <div className="flex gap-3 flex-wrap mt-6 w-1/2">{items}</div>
        </div>
      )}
    </div>
  );
};

export default NoResults;
