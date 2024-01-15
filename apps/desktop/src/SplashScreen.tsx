import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Trans } from 'react-i18next';
import { LogoFull } from '../../../client/src/icons';

type Props = {};

const SplashScreen = ({}: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      key="splash"
      className="w-screen h-screen flex items-center justify-center bg-bg-sub fixed top-0 left-0 z-10"
    >
      <div className="w-99 rounded-xl border border-bg-border bg-bg-base px-12 py-20 relative animate-pulse-shadow-slow z-0">
        <div
          className={`absolute top-0 left-1/2 z-10 transform -translate-x-1/2 h-px w-1/2 
        bg-[linear-gradient(90deg,rgba(var(--label-base),0.00)_0%,rgb(var(--label-base))_50%,rgba(var(--label-base),0.00)_100%)]`}
        />
        <div
          className={`absolute top-0 left-1/2 z-20 transform -translate-x-1/2 h-px w-1/2 animate-opacity-slow
        bg-[linear-gradient(90deg,rgba(var(--label-link),0.00)_0%,rgb(var(--label-link))_50%,rgba(var(--label-link),0.00)_100%)]`}
        />
        <div className="animate-pulse-slow text-label-title">
          <LogoFull />
        </div>
        <div className="flex gap-3 items-center rounded-lg shadow-high border border-bg-border bg-bg-shade px-4 py-2 absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 body-s-b z-10 text-label-base">
          <Trans>Loading...</Trans>
        </div>
      </div>
    </motion.div>
  );
};

export default memo(SplashScreen);
