import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import DialogText from '../DialogText';
import Button from '../../../components/Button';
import { ArrowRight } from '../../../icons';
import SearchableRepoList from '../../../components/RepoList/SearchableRepoList';
import {
  RepoProvider,
  RepoType,
  RepoUi,
  SyncStatus,
} from '../../../types/general';
import GoBackButton from '../GoBackButton';
import { UIContext } from '../../../context/uiContext';
import { splitPath } from '../../../utils';
import { RepositoriesContext } from '../../../context/repositoriesContext';

type Props = {
  handleNext: (e?: any) => void;
  handleBack?: (e: any) => void;
  disableSkip?: boolean;
};

export const STEP_KEY = 'STEP_GITHUB_REPOS';
let intervalId: number;

const GithubReposStep = ({ handleNext, handleBack, disableSkip }: Props) => {
  const { t } = useTranslation();
  const [repos, setRepos] = useState<RepoUi[]>([]);
  const [isLoading, setLoading] = useState(true);
  const { repositories } = useContext(RepositoriesContext);

  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext();
    },
    [],
  );

  useEffect(() => {
    const githubRepos: RepoType[] =
      repositories?.filter(
        (r: RepoType) => r.provider === RepoProvider.GitHub,
      ) || [];

    setRepos(
      githubRepos
        .map((r) => {
          const pathParts = splitPath(r.name);
          return {
            ...r,
            shortName: pathParts[pathParts.length - 1],
            folderName: pathParts[0],
            alreadySynced: ![
              SyncStatus.Uninitialized,
              SyncStatus.Removed,
            ].includes(r.sync_status),
          };
        })
        .sort((a, b) =>
          a.folderName.toLowerCase() < b.folderName.toLowerCase()
            ? -1
            : a.folderName.toLowerCase() > b.folderName.toLowerCase()
            ? 1
            : a.shortName.toLowerCase() < b.shortName.toLowerCase()
            ? -1
            : 1,
        ),
    );
    setLoading(false);
  }, [repositories]);

  useEffect(() => {
    if (repos.length && intervalId) {
      clearInterval(intervalId);
    }
  }, [repos]);

  return (
    <>
      <DialogText
        title={t('Private repository')}
        description={t('Select any private repository you would like to sync')}
      />
      <div className="flex flex-col overflow-auto">
        <SearchableRepoList
          items={repos}
          type="GitHub"
          isLoading={isLoading}
          onSync={handleNext}
        />
        {!disableSkip ? (
          <Button variant="secondary" onClick={handleSkip}>
            <Trans>Skip this step</Trans>
            <ArrowRight />
          </Button>
        ) : null}
      </div>
      {handleBack ? <GoBackButton handleBack={handleBack} /> : null}
    </>
  );
};

export default GithubReposStep;
