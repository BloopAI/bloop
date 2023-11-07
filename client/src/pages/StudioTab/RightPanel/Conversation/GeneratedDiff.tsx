import { memo, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BranchMerged } from '../../../../icons';
import NewCode from '../../../../components/MarkdownWithCode/NewCode';

type Props = {
  diff: string;
};

const GeneratedDiff = ({ diff }: Props) => {
  useTranslation();
  const filePath = useMemo(() => {
    const match = diff.match(/^--- (.*)\s/);
    return match?.[1];
  }, [diff]);

  const language = useMemo(() => {
    if (filePath) {
      return filePath.split('.').slice(-1)[0];
    }
  }, [filePath]);

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
        <NewCode
          isCodeStudio
          filePath={filePath || ''}
          language={language || 'diff'}
          code={diff.split('\n').slice(2).join('\n')}
        />
      </div>
    </div>
  );
};

export default memo(GeneratedDiff);
