import React, { useCallback, useContext, useEffect, useState } from 'react';
import DialogText from '../DialogText';
import Button from '../../../components/Button';
import { ArrowRight } from '../../../icons';
import SearchableRepoList from '../../../components/RepoList/SearchableRepoList';
import { getRepos, syncRepos } from '../../../services/api';
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

type Props = {
  handleNext: (e?: any) => void;
  handleBack?: (e: any) => void;
  disableSkip?: boolean;
};

const STEP_KEY = 'STEP_GITHUB_REPOS';
let intervalId: number;

const GithubReposStep = ({ handleNext, handleBack, disableSkip }: Props) => {
  const [activeTab, setActiveTab] = useState(1);
  const [userRepos, setUserRepos] = useState<RepoType[]>([]);
  const [repos, setRepos] = useState<RepoUi[]>([]);
  const [nextButtonDisabled, setNextButtonDisabled] = useState(false);
  const { onBoardingState, setOnBoardingState } = useContext(UIContext);
  const { trackReposSelected } = useAnalytics();

  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      const reposToSync = repos
        .filter((r) => (activeTab === 1 ? r.selected : r))
        .map((r) => r.ref);

      const localRepos = userRepos
        .filter(
          (r) =>
            r.provider === RepoProvider.Local &&
            ![SyncStatus.Uninitialized, SyncStatus.Removed].includes(
              r.sync_status,
            ),
        )
        .map((r) => r.ref);
      trackReposSelected({
        githubRepos: reposToSync.length,
        localRepos: localRepos.length,
        where: 'onboarding_step_github_repos',
      });
      syncRepos([...reposToSync, ...localRepos]).then(console.log);
      handleNext();
    },
    [repos, userRepos],
  );
  useEffect(() => {
    if (repos.length) {
      setOnBoardingState((prev) => ({
        ...prev,
        [STEP_KEY]: repos.filter((r) => r.selected).map((r) => r.ref),
      }));
      setNextButtonDisabled(!repos.filter((r) => r.selected).length);
    } else {
      setNextButtonDisabled(true);
    }
  }, [repos]);

  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext();
    },
    [],
  );

  const fetchRepos = useCallback(() => {
    getRepos().then((data) => {
      const githubRepos: RepoType[] = data.list.filter(
        (r: RepoType) => r.provider === RepoProvider.GitHub,
      );
      setUserRepos(data.list);
      const selectedRepos = onBoardingState[STEP_KEY];

      setRepos(
        githubRepos
          .map((r) => {
            const pathParts = splitPath(r.name);
            let selected: boolean = selectedRepos?.length
              ? !!selectedRepos.includes(r.ref)
              : false;
            return {
              ...r,
              selected,
              shortName: pathParts[pathParts.length - 1],
              folderName: pathParts[0],
            };
          })
          .sort((a, b) => (a.folderName > b.folderName ? -1 : 1)),
      );
    });
  }, []);

  useEffect(() => {
    fetchRepos();
    intervalId = window.setInterval(() => {
      fetchRepos();
    }, 2000);
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    if (repos.length && intervalId) {
      clearInterval(intervalId);
    }
  }, [repos]);

  return (
    <>
      <DialogText
        title="Sync GitHub repositories"
        description="Select the GitHub repositories you want to add to bloop. You can always sync, unsync or remove unwanted repositories later."
      />
      <div className="flex flex-col overflow-auto">
        <SearchableRepoList
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          repos={repos}
          setRepos={setRepos}
          source="GitHub"
        />
        <div className="flex flex-col gap-4 mt-4">
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            disabled={nextButtonDisabled}
          >
            Sync repositories
          </Button>
          {!disableSkip ? (
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

export default GithubReposStep;
