import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BranchMerged } from '../../../../icons';
import CodeDiff from '../../../../components/CodeBlock/CodeDiff';
import { GeneratedCodeDiff } from '../../../../types/api';
import {
  DiffChunkType,
  StudioLeftPanelDataType,
  StudioLeftPanelType,
} from '../../../../types/general';
import { RepositoriesContext } from '../../../../context/repositoriesContext';

type Props = {
  diff: GeneratedCodeDiff;
  setLeftPanel: Dispatch<SetStateAction<StudioLeftPanelDataType>>;
};

const GeneratedDiff = ({ diff, setLeftPanel }: Props) => {
  useTranslation();
  const { repositories } = useContext(RepositoriesContext);

  const onDiffClick = useCallback(
    (chunk: DiffChunkType) => {
      const repoFull = repositories?.find((r) => r.ref === chunk.repo);
      if (repoFull) {
        setLeftPanel({
          type: StudioLeftPanelType.DIFF,
          data: {
            filePath: chunk.file,
            repo: repoFull,
            branch: chunk.branch,
            hunks: chunk.hunks,
          },
        });
      }
    },
    [repositories],
  );

  return (
    <div className="flex flex-col rounded-6 overflow-hidden border border-transparent hover:shadow-medium hover:border-bg-border-hover focus-within:border-bg-main bg-bg-base hover:focus-within:border-bg-main focus-within:shadow-medium transition-all duration-150 ease-in-out">
      <div className="w-full bg-bg-shade">
        <div className="w-full flex items-center justify-center gap-1 py-2 bg-bg-main/15 text-label-link caption">
          <BranchMerged raw sizeClassName="w-3.5 h-3.5" />
          <Trans>Generated diffs to be applied</Trans>
        </div>
      </div>
      <div className=" p-4">
        <p className="body-s text-label-title">
          <Trans>
            The following changes can be applied to your repository. Make sure
            the generated diffs are valid before you apply the changes.
          </Trans>
        </p>
        {diff.chunks.map((d) => (
          <CodeDiff
            key={d.file}
            filePath={d.file}
            language={d.lang || 'diff'}
            {...d}
            onClick={onDiffClick}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(GeneratedDiff);
