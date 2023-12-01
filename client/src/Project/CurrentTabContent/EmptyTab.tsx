import { memo } from 'react';
import { Trans } from 'react-i18next';

type Props = {};

const EmptyTab = ({}: Props) => {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center gap-6">
      <div className="w-15 h-15 flex items-center justify-center rounded-xl border border-bg-divider">
        <img alt="bloop" className="w-6 h-6 bloop-head-img" />
      </div>
      <div className="flex flex-col gap-2 items-center text-center max-w-[18.75rem]">
        <p className="body-base-b text-label-title">
          <Trans>No file selected</Trans>
        </p>
        <p className="body-s text-label-base !leading-5">
          <Trans>Select a file or open a new tab to display it here.</Trans>{' '}
          <Trans>
            Press{' '}
            <span className="w-5 h-5 px-1 items-center justify-center rounded border border-bg-border bg-bg-base shadow-low">
              K
            </span>{' '}
            on your keyboard to open the Command bar.
          </Trans>
        </p>
      </div>
    </div>
  );
};

export default memo(EmptyTab);
