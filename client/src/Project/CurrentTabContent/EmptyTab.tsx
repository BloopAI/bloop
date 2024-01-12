import { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import useShortcuts from '../../hooks/useShortcuts';

type Props = {};

const EmptyTab = ({}: Props) => {
  useTranslation();
  const shortcut = useShortcuts(['cmd']);
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center gap-6 select-none cursor-default">
      <div className="w-15 h-15 flex items-center justify-center rounded-xl border border-bg-divider">
        <img alt="bloop" className="w-6 h-6 bloop-head-img" />
      </div>
      <div className="flex flex-col gap-2 items-center text-center max-w-[18.75rem]">
        <p className="body-base-b text-label-title">
          <Trans>No file selected</Trans>
        </p>
        <p className="body-s text-label-base !leading-5">
          <Trans>Select a file or open a new tab to display it here.</Trans>{' '}
          <Trans values={{ cmdKey: shortcut?.[0] }}>
            Press{' '}
            <span className="min-w-[20px] h-5 px-0.5 inline-flex items-center justify-center rounded border border-bg-border bg-bg-base shadow-low">
              cmdKey
            </span>{' '}
            <span className="w-5 h-5 inline-flex items-center justify-center rounded border border-bg-border bg-bg-base shadow-low">
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
