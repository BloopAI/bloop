import { useCallback, useContext, useState } from 'react';
import { MessageResultModify } from '../../../types/general';
import Button from '../../../components/Button';
import { GitPod, Info } from '../../../icons';
import { commitChanges } from '../../../services/api';
import { DeviceContext } from '../../../context/deviceContext';
import ThreeDotsLoader from '../../../components/Loaders/ThreeDotsLoader';
import DiffCode from './DiffCode';

type Props = {
  repoName: string;
  repoRef: string;
  diffs: MessageResultModify['Modify'][];
};

const Diff = ({ diffs, repoName, repoRef }: Props) => {
  const { openLink } = useContext(DeviceContext);
  const [staged, setStaged] = useState<number[]>([]);
  const [isSubmitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [gitpodLink, setGitPodLink] = useState('');

  const onStage = useCallback((i: number) => {
    setStaged((prev) => [...prev, i]);
  }, []);
  const onUnstage = useCallback((i: number) => {
    setStaged((prev) => prev.filter((p) => p !== i));
  }, []);
  const onStageAll = useCallback(() => {
    setStaged(diffs.map((_, i) => i));
  }, []);

  const onSubmit = useCallback(async () => {
    setSubmitted(true);
    try {
      const { branch_name, commit_id } = await commitChanges({
        repo: repoRef,
        push: true,
        changes: staged.map((i) => {
          return {
            path: diffs[i].path,
            diff: diffs[i].raw + '\n',
          };
        }),
      });
      setError('');
      setGitPodLink(
        `https://gitpod.io/#https://${repoRef}/commit/${commit_id}`,
      );
    } catch (err) {
      setSubmitted(false);
      setError('There was an error making this commit');
    }
  }, [diffs, staged]);

  return (
    <div className="flex flex-col gap-4">
      <div className="absolute top-8 right-8">
        {isSubmitted ? (
          <div>
            <Button
              size="small"
              onClick={() => (gitpodLink ? openLink(gitpodLink) : {})}
            >
              {!gitpodLink ? (
                <span className="px-4 text-label-control">
                  <ThreeDotsLoader />
                </span>
              ) : (
                'Preview in GitPod'
              )}
              <GitPod />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button onClick={onStageAll} variant="tertiary" size="small">
              Stage all
            </Button>
            <Button
              onClick={onSubmit}
              size="small"
              disabled={!staged.length}
              tooltipText={
                <span>
                  We will commit your changes to a new branch
                  <br /> which you can preview in GitPod
                </span>
              }
            >
              Commit staged changes ({staged.length})
            </Button>
          </div>
        )}
      </div>
      {!!error && (
        <div className="flex items-center rounded-4 gap-3 p-3 bg-bg-danger/8 text-bg-danger caption-strong">
          <div className="w-5 h-5">
            <Info raw />
          </div>
          <p>Committing your changes has failed. Please try again later.</p>
        </div>
      )}
      {diffs.map((d, i) => (
        <DiffCode
          key={i}
          data={d}
          repoName={repoName}
          isStaged={staged.includes(i)}
          onStage={onStage}
          onUnstage={onUnstage}
          isSubmitted={isSubmitted}
          i={i}
        />
      ))}
    </div>
  );
};

export default Diff;
