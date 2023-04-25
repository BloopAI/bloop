import React, { useCallback, useContext, useEffect, useState } from 'react';
import DialogText from '../DialogText';
import Button from '../../../components/Button';
import { ArrowRight } from '../../../icons';
import SearchableRepoList from '../../../components/RepoList/SearchableRepoList';
import { scanLocalRepos, syncRepos } from '../../../services/api';
import {
  RepoProvider,
  RepoType,
  RepoUi,
  SyncStatus,
} from '../../../types/general';
import GoBackButton from '../GoBackButton';
import { UIContext } from '../../../context/uiContext';
import useAnalytics from '../../../hooks/useAnalytics';
import { splitPath } from '../../../utils';
import { RepositoriesContext } from '../../../context/repositoriesContext';

type Props = {
  handleNext: (e?: any) => void;
  handleBack?: (e: any) => void;
};

const STEP_KEY = 'STEP_LOCAL_REPOS';

const LocalReposStep = ({ handleNext, handleBack }: Props) => {
  const [activeTab, setActiveTab] = useState(1);
  const [userRepos, setUserRepos] = useState<RepoType[]>([]);
  const [repos, setRepos] = useState<RepoUi[]>([]);
  const [nextButtonDisabled, setNextButtonDisabled] = useState(false);
  const { onBoardingState, setOnBoardingState } = useContext(UIContext);
  const { trackReposSelected } = useAnalytics();
  const { repositories } = useContext(RepositoriesContext);

  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      const reposToSync = repos
        .filter((r) => (activeTab === 1 ? r.selected : r))
        .map((r) => r.ref);
      const prevSyncedLocalRepos =
        repositories
          ?.filter(
            (r) =>
              r.provider === RepoProvider.Local &&
              ![SyncStatus.Uninitialized, SyncStatus.Removed].includes(
                r.sync_status,
              ) &&
              !repos.find((repo) => r.ref === repo.ref),
          )
          .map((r) => r.ref) || [];
      const githubRepos =
        repositories
          ?.filter(
            (r) =>
              r.provider === RepoProvider.GitHub &&
              ![SyncStatus.Uninitialized, SyncStatus.Removed].includes(
                r.sync_status,
              ),
          )
          .map((r) => r.ref) || [];
      trackReposSelected({
        localRepos: reposToSync.length,
        githubRepos: githubRepos.length,
        where: 'onboarding_step_local_repos',
      });
      syncRepos([...prevSyncedLocalRepos, ...reposToSync, ...githubRepos]).then(
        console.log,
      );
      handleNext();
    },
    [repos, userRepos, repositories],
  );

  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext();
    },
    [],
  );

  useEffect(() => {
    if (onBoardingState.indexFolder) {
      scanLocalRepos(onBoardingState.indexFolder).then((data) => {
        setUserRepos(data.list);
        const selectedRepos = onBoardingState[STEP_KEY];

        const mainFolder = splitPath(onBoardingState.indexFolder).pop() || '';

        setRepos(
          data.list
            .map((r: RepoType) => {
              const pathParts = splitPath(r.ref);
              const folder = `/${pathParts
                .slice(pathParts.indexOf(mainFolder), pathParts.length - 1)
                .join('/')}`;
              let selected: boolean =
                selectedRepos && selectedRepos.length
                  ? selectedRepos.includes(r.ref)
                  : false;
              return {
                ...r,
                selected,
                folderName: folder,
                shortName: pathParts[pathParts.length - 1],
              };
            })
            .sort((a: RepoUi, b: RepoUi) => a.folderName > b.folderName),
        );
      });
    }
  }, [onBoardingState.indexFolder]);

  useEffect(() => {
    if (repos.length) {
      setOnBoardingState((prevState) => ({
        ...prevState,
        [STEP_KEY]: repos.filter((r) => r.selected).map((r) => r.ref),
      }));
      setNextButtonDisabled(!repos.filter((r) => r.selected).length);
    } else {
      setNextButtonDisabled(true);
    }
  }, [repos]);

  return (
    <>
      <DialogText
        title="Sync local repositories"
        description="Select the folders you want to add to bloop. You can always sync, unsync or remove unwanted repositories later."
      />
      <div className="flex flex-col overflow-auto h-full">
        <SearchableRepoList
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          repos={repos}
          setRepos={setRepos}
          source="local"
        />
        <div
          className={`flex flex-col gap-4 ${
            onBoardingState.indexFolder ? 'mt-4' : ''
          }`}
        >
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            disabled={nextButtonDisabled}
          >
            Sync repositories
          </Button>
          {handleBack ? (
            <Button variant="secondary" onClick={handleSkip}>
              Skip this step
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      </div>
      {handleBack ? <GoBackButton handleBack={handleBack} /> : null}
    </>
  );
};

export default LocalReposStep;
