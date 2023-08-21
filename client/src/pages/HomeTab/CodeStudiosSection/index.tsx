import { memo } from 'react';
import { Trans } from 'react-i18next';
import { CodeStudioShortType } from '../../../types/general';
import CodeStudioCard from './CodeStudioCard';

type Props = {
  codeStudios: CodeStudioShortType[];
};

const CodeStudiosSection = ({ codeStudios }: Props) => {
  return (
    <div className="p-8 overflow-x-auto relative">
      {!!codeStudios.length && (
        <h4 className="h4 text-label-title mb-3">
          <Trans>All studio projects</Trans>
        </h4>
      )}
      <div className="flex flex-wrap gap-3.5 w-full relative items-start">
        {codeStudios.map((cs) => (
          <CodeStudioCard key={cs.id} {...cs} />
        ))}
      </div>
    </div>
  );
};

export default memo(CodeStudiosSection);
