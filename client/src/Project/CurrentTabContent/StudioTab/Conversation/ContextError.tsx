import { memo } from 'react';
import { Trans } from 'react-i18next';
import { WarningSignIcon } from '../../../../icons';

type Props = {};

const ContextError = ({}: Props) => {
  return (
    <div className="w-full flex items-center gap-4 p-4 select-none">
      <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-red-subtle text-red">
        <WarningSignIcon sizeClassName="w-3.5 h-3.5" />
      </div>
      <p className="body-s text-red flex-1">
        <Trans>
          We can’t generate a response because some files have a missing source
          in your Context files.
        </Trans>
      </p>
    </div>
  );
};

export default memo(ContextError);
