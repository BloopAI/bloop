import React, { FormEvent, useCallback, useContext, useState } from 'react';
import axios from 'axios';
import DialogText from '../DialogText';
import Button from '../../../components/Button';
import { ArrowRight } from '../../../icons';
import { syncRepos } from '../../../services/api';
import GoBackButton from '../GoBackButton';
import { UIContext } from '../../../context/uiContext';
import useAnalytics from '../../../hooks/useAnalytics';
import { STEP_KEY as LOCAL_STEP_KEY } from '../LocalReposStep';
import { STEP_KEY as GITHUB_STEP_KEY } from '../GithubReposStep';
import TextInput from '../../../components/TextInput';
import RepoList from '../../../components/RepoList';
import { RepoProvider, RepoUi, SyncStatus } from '../../../types/general';

type Props = {
  handleNext: (e?: any) => void;
  handleBack?: (e: any) => void;
  disableSkip?: boolean;
};

export const STEP_KEY = 'STEP_PUBLIC_GITHUB_REPOS';

const PublicGithubReposStep = ({
  handleNext,
  handleBack,
  disableSkip,
}: Props) => {
  const [repos, setRepos] = useState<RepoUi[]>([]);
  const [newRepoValue, setNewRepoValue] = useState('');
  const { onBoardingState, setOnBoardingState } = useContext(UIContext);
  const { trackReposSelected } = useAnalytics();
  const [isVerifying, setVerifying] = useState(false);
  const [errorVerifying, setErrorVerifying] = useState(false);

  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      const reposToSync = repos.map(
        (r) => `github.com/${r.folderName}/${r.shortName}`,
      );
      setOnBoardingState((prevState) => ({
        ...prevState,
        [STEP_KEY]: reposToSync,
      }));

      const githubRepos = onBoardingState[GITHUB_STEP_KEY];

      const localRepos = onBoardingState[LOCAL_STEP_KEY];

      trackReposSelected({
        githubRepos: githubRepos.length,
        publicGithubRepos: reposToSync.length,
        localRepos: localRepos.length,
        where: 'onboarding_step_public_github_repos',
      });
      syncRepos([...reposToSync, ...githubRepos, ...localRepos]);
      handleNext();
    },
    [repos, onBoardingState],
  );

  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext();
    },
    [],
  );

  const handleAddRepo = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setVerifying(true);
      const cleanRef = newRepoValue
        .replace('https://', '')
        .replace('github.com/', '')
        .replace(/\/$/, '');
      setNewRepoValue(cleanRef);
      axios(`https://api.github.com/repos/${cleanRef}`)
        .then((resp) => {
          if (resp?.data?.visibility === 'public') {
            const [orgName, repoName] = cleanRef.split('/');
            setRepos((prev) => [
              ...prev,
              {
                folderName: orgName,
                name: newRepoValue,
                shortName: repoName,
                last_index: '',
                last_update: '',
                local_duplicates: [],
                most_common_lang: '',
                ref: `github.com/${newRepoValue}`,
                selected: true,
                provider: RepoProvider.GitHub,
                sync_status: SyncStatus.Uninitialized,
              },
            ]);
            setNewRepoValue('');
          } else {
            setErrorVerifying(true);
          }
        })
        .catch((err) => {
          console.log(err);
          setErrorVerifying(true);
        })
        .finally(() => {
          setVerifying(false);
        });
    },
    [newRepoValue],
  );

  return (
    <>
      <DialogText
        title="Public repositories"
        description="Paste a link to any public repository you would like to index."
      />
      <div className="flex flex-col overflow-auto">
        <div className="flex flex-col gap-3">
          <form className="flex gap-2" onSubmit={handleAddRepo}>
            <TextInput
              value={newRepoValue}
              name="new-repo"
              onChange={(e) => {
                setErrorVerifying(false);
                setNewRepoValue(e.target.value);
              }}
              variant="outlined"
              placeholder="Repository url..."
              error={
                errorVerifying
                  ? "This repository isn't public  / We couldn't find this repository"
                  : undefined
              }
            />
            <Button
              type="submit"
              disabled={!newRepoValue || errorVerifying || isVerifying}
            >
              {isVerifying ? 'Verifying access...' : 'Add'}
            </Button>
          </form>
          {!!repos.length && (
            <RepoList
              repos={repos}
              setRepos={() => {}}
              source={'GitHub'}
              activeTab={0}
              removable
              handleRemoveOne={(repoRef) =>
                setRepos((prev) => prev.filter((r) => r.ref !== repoRef))
              }
            />
          )}
        </div>
        <div className="flex flex-col gap-4 mt-8">
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            disabled={!repos.length}
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

export default PublicGithubReposStep;
