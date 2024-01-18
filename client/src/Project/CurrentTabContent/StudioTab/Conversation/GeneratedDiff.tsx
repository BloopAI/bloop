import { Dispatch, memo, SetStateAction, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { GeneratedCodeDiff } from '../../../../types/api';
import { BranchIcon, WarningSignIcon } from '../../../../icons';
import CodeDiff from '../../../../components/Code/CodeDiff';

type Props = {
  diff: GeneratedCodeDiff;
  onDiffRemoved: (i: number) => void;
  onDiffChanged: (i: number, p: string) => void;
  applyError?: boolean;
};

const GeneratedDiff = ({
  diff,
  onDiffRemoved,
  onDiffChanged,
  applyError,
}: Props) => {
  useTranslation();
  // const { repositories } = useContext(RepositoriesContext);

  // const onDiffClick = useCallback(
  //   (chunk: DiffChunkType) => {
  // const repoFull = repositories?.find((r) => r.ref === chunk.repo);
  // if (repoFull) {
  // setLeftPanel({
  //   type: StudioLeftPanelType.DIFF,
  //   data: {
  //     filePath: chunk.file,
  //     repo: repoFull,
  //     branch: chunk.branch,
  //     hunks: chunk.hunks,
  //   },
  // });
  // }
  //   },
  //   [repositories],
  // );
  const onDiffClick = useCallback(() => {}, []);

  return (
    <div className="flex flex-col rounded-6 overflow-hidden border border-transparent hover:shadow-medium hover:border-bg-border-hover focus-within:border-bg-main bg-bg-base hover:focus-within:border-bg-main focus-within:shadow-medium transition-all duration-150 ease-in-out">
      <div className="w-full bg-bg-shade">
        <div
          className={`w-full flex items-center justify-center gap-1 py-2 ${
            applyError
              ? 'bg-bg-danger/12 text-bg-danger'
              : ' bg-bg-main/15 text-label-link'
          } caption`}
        >
          {applyError ? (
            <WarningSignIcon raw sizeClassName="w-3.5 h-3.5" />
          ) : (
            <BranchIcon raw sizeClassName="w-3.5 h-3.5" />
          )}
          <Trans>
            {applyError
              ? 'Failed to apply the diff'
              : 'Generated diffs to be applied'}
          </Trans>
        </div>
      </div>
      <div className=" p-4">
        <p className="body-s text-label-title">
          {diff.chunks.find((c) => c.repo.startsWith('local//')) ? (
            <Trans>
              The following changes can be applied to your repository. Make sure
              the generated diffs are valid before you apply the changes.
            </Trans>
          ) : (
            <Trans>
              The following changes represent the git diff for the remote
              repository. Please note that these changes cannot be applied
              directly to a remote repository. Use the &quot;Copy&quot; button
              to copy the changes and apply them locally.
            </Trans>
          )}
        </p>
        {diff.chunks.map((d, i) => (
          <CodeDiff
            key={d.file}
            filePath={d.file}
            language={d.lang || 'diff'}
            {...d}
            i={i}
            onClick={onDiffClick}
            onDiffChanged={onDiffChanged}
            onDiffRemoved={onDiffRemoved}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(GeneratedDiff);
