import React, { useCallback, useContext, useEffect, useState } from 'react';
import DialogText from '../DialogText';
import Button from '../../../../components/Button';
import { ArrowRight } from '../../../../icons';
import RepoList from '../../../../components/RepoList';
import { getRepos, syncRepos } from '../../../../services/api';
import {
  RepoProvider,
  RepoType,
  RepoUi,
  SyncStatus,
} from '../../../../types/general';
import GoBackButton from '../GoBackButton';
import { UIContext } from '../../../../context/uiContext';
import useAnalytics from '../../../../hooks/useAnalytics';
import { splitPath } from '../../../../utils';
import Tabs from '../../../../components/Tabs';

type Props = {
  handleNext: (e?: any) => void;
  handleBack?: (e: any) => void;
};

const STEP_KEY = 'STEP_4';
const tabs = [{ title: 'Sync all repos' }, { title: 'Sync selected repos' }];

const Step4 = ({ handleNext, handleBack }: Props) => {
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
        where: 'onboarding_step_4',
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

  useEffect(() => {
    getRepos().then((data) => {
      const githubRepos: RepoType[] = data.list.filter(
        (r: RepoType) => r.provider === RepoProvider.GitHub,
      );
      setUserRepos(data.list);
      const selectedRepos = onBoardingState[STEP_KEY];

      setRepos(
        githubRepos.map((r) => {
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
        }),
      );
    });
  }, []);

  return (
    <>
      <DialogText
        title="Sync GitHub repositories"
        description="Select the GitHub repositories you want to add to bloop. You can always sync, unsync or removed unwanted repositories later."
      />
      <div className="flex flex-col overflow-auto">
        <div className="flex flex-col overflow-auto">
          <div className="overflow-hidden flex-shrink-0">
            <Tabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              tabs={tabs}
              variant="button"
              fullWidth
            />
          </div>
          <RepoList
            repos={repos}
            setRepos={setRepos}
            source="GitHub"
            activeTab={activeTab}
          />
        </div>
        <div className="flex flex-col gap-4 mt-4">
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

export default Step4;
