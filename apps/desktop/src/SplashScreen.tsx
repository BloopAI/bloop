import React, { memo } from 'react';
import { LogoFull } from '../../../client/src/icons';

type Props = {};

const SplashScreen = ({}: Props) => {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-bg-sub">
      <div className="w-99 rounded-xl border border-bg-border bg-[linear-gradient(169deg,#232327_0%,#1A1A20_100%)] px-12 py-20 relative animate-pulse-shadow-slow z-0">
        <div
          className={`absolute top-0 left-1/2 z-10 transform -translate-x-1/2 h-px w-1/2 
        bg-[linear-gradient(90deg,rgba(48,48,55,0.00)_0%,#9F9FB5_50%,rgba(48,48,55,0.00)_100%)]`}
        />
        <div
          className={`absolute top-0 left-1/2 z-20 transform -translate-x-1/2 h-px w-1/2 animate-opacity-slow
        bg-[linear-gradient(90deg,rgba(91,110,221,0.00)_0%,#5B6EDD_50%,rgba(91,110,221,0.00)_100%)]`}
        />
        <div className="animate-pulse-slow">
          <LogoFull />
        </div>
        <div className="flex gap-3 items-center rounded-lg shadow-high border border-bg-border bg-bg-base px-4 py-2 absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 body-s z-10">
          Loading...
        </div>
      </div>
    </div>
  );
};

export default memo(SplashScreen);
