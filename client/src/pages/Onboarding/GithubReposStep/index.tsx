import React, { useCallback, useContext, useEffect, useState } from 'react';
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
  const [repos, setRepos] = useState<RepoUi[]>([]);
  const [nextButtonDisabled, setNextButtonDisabled] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const { onBoardingState, setOnBoardingState } = useContext(UIContext);
  const { repositories } = useContext(RepositoriesContext);

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

  useEffect(() => {
    const githubRepos: RepoType[] =
      repositories?.filter(
        (r: RepoType) =>
          r.provider === RepoProvider.GitHub &&
          [SyncStatus.Uninitialized, SyncStatus.Removed].includes(
            r.sync_status,
          ),
      ) || [];
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
        .sort((a, b) =>
          a.folderName > b.folderName
            ? -1
            : a.folderName < b.folderName
            ? 1
            : a.shortName < b.shortName
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
        title="Private repository"
        description="Select any private repository you would like to sync"
      />
      <div className="flex flex-col overflow-auto">
        <SearchableRepoList
          repos={repos}
          source="GitHub"
          isLoading={isLoading}
          onSync={handleNext}
        />
        <div className="flex flex-col gap-4 mt-8">
          <Button type="submit" variant="primary" disabled={nextButtonDisabled}>
            Sync repository
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
