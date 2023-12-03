import React, { memo, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Header from '../components/Header';
import { PlusSignIcon, ShapesIcon } from '../icons';
import Button from '../components/Button';
import { CommandBarContext } from '../context/commandBarContext';

type Props = {};

const EmptyProject = ({}: Props) => {
  useTranslation();
  const { setIsVisible } = useContext(CommandBarContext.Handlers);

  const openCommandBar = useCallback(() => {
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
              <p className="body-s-b text-label-base">
                <Trans>
                  Start by adding your first repository or documentation
                  library.
                </Trans>
              </p>
            </div>
            <Button size="large" onClick={openCommandBar}>
              <PlusSignIcon />
              <Trans>Add context</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(EmptyProject);
