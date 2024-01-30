import { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CodeStudioIcon } from '../../../../icons';

type Props = {};

const StarterMessage = ({}: Props) => {
  useTranslation();
  return (
    <div className="flex items-start gap-5 rounded-md p-4">
      <div className="flex w-7 h-7 items-center justify-center rounded-full bg-brand-studio-subtle">
        <img className="bloop-head-img w-7 h-7" alt="bloop" />
      </div>
      <div className="flex flex-col gap-1 flex-1">
        <p className="body-base-b text-label-title select-none">bloop</p>
        <p className="text-label-base body-base">
          <Trans>
            Hi, I am bloop! In{' '}
            <span className="body-base-b inline-flex items-center gap-1 relative top-0.5">
              <CodeStudioIcon
                sizeClassName="w-4 h-4"
                className="text-brand-studio"
              />
              Studio mode
            </span>{' '}
            you can choose files from your codebase, write a prompt and generate
            patches, scripts and tests.
          </Trans>
        </p>
      </div>
    </div>
  );
};

export default memo(StarterMessage);
