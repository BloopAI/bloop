import { useCallback, useState } from 'react';
import { MessageResultModify } from '../../../types/general';
import Button from '../../../components/Button';
import { GitPod } from '../../../icons';
import DiffCode from './DiffCode';

type Props = {
  repoName: string;
  diffs: MessageResultModify['Modify'][];
};

const Diff = ({ diffs, repoName }: Props) => {
  const [staged, setStaged] = useState<number[]>([]);
  const [isSubmitted, setSubmitted] = useState(false);

  const onStage = useCallback((i: number) => {
    setStaged((prev) => [...prev, i]);
  }, []);
  const onUnstage = useCallback((i: number) => {
    setStaged((prev) => prev.filter((p) => p !== i));
  }, []);
  const onStageAll = useCallback(() => {
    setStaged(diffs.map((_, i) => i));
  }, []);

  const onSubmit = useCallback(() => {
    setSubmitted(true);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="absolute top-8 right-8">
        {isSubmitted ? (
          <div>
            <Button variant="secondary" size="small">
              Preview in GitPod
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
              title="Gitpod will commit your changes to a new branch"
            >
              Commit staged changes ({staged.length})
            </Button>
          </div>
        )}
      </div>
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
