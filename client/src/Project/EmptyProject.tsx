import React, { memo, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Header from '../components/Header';
import { PlusSignIcon, ShapesIcon } from '../icons';
import Button from '../components/Button';
import { CommandBarContext } from '../context/commandBarContext';
import { CommandBarStepEnum } from '../types/general';
import useShortcuts from '../hooks/useShortcuts';

type Props = {};

const EmptyProject = ({}: Props) => {
  useTranslation();
  const shortcut = useShortcuts(['cmd']);
  const { setIsVisible, setChosenStep } = useContext(
    CommandBarContext.Handlers,
  );

  const openCommandBar = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.MANAGE_REPOS });
    setIsVisible(true);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col">
      <Header />
      <div className="w-full h-[calc(100vh-2.5rem)] flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col gap-6 items-center select-none">
            <div className="p-3.5 flex items-center justify-center border border-bg-divider rounded-xl">
              <ShapesIcon sizeClassName="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-2 items-center max-w-[15.875rem] text-center">
              <p className="body-base-b text-label-title">
                <Trans>This project is empty</Trans>
              </p>
              <p className="body-s text-label-base !leading-5">
                <Trans values={{ cmdKey: shortcut?.[0] }}>
                  Press{' '}
                  <span className="min-w-[20px] h-5 px-0.5 inline-flex items-center justify-center rounded border border-bg-border bg-bg-base shadow-low">
                    cmdKey
                  </span>{' '}
                  <span className="w-5 h-5 inline-flex items-center justify-center rounded border border-bg-border bg-bg-base shadow-low">
                    K
                  </span>{' '}
                  on your keyboard to open the Command bar and add a repository.
                </Trans>
              </p>
            </div>
            <Button size="large" onClick={openCommandBar}>
              <Trans>Open Command Bar</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(EmptyProject);
