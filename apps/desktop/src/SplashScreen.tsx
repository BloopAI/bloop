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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
          >
            <path
              d="M16.8759 9.00024C16.8759 13.4251 13.3154 17.0002 8.93793 17.0002C4.56045 17.0002 1 13.4251 1 9.00024C1 4.57543 4.56045 1.00024 8.93793 1.00024C13.3154 1.00024 16.8759 4.57543 16.8759 9.00024Z"
              stroke="#303037"
              strokeWidth="2"
            />
            <mask id="path-2-inside-1_11154_53986" fill="white">
              <path d="M9.06207 0.9894C9.06207 0.442969 9.5064 -0.00569609 10.0494 0.0550816C11.0784 0.170244 12.0822 0.464843 13.0152 0.928146C14.2448 1.53872 15.3184 2.42593 16.153 3.52115C16.9876 4.61636 17.5608 5.89022 17.8283 7.24419C18.0318 8.2747 18.0541 9.33058 17.8967 10.3642C17.8148 10.9022 17.2685 11.2142 16.7431 11.0724C16.2202 10.9313 15.9172 10.3937 15.9828 9.85611C16.073 9.11655 16.046 8.36512 15.9009 7.63023C15.6922 6.57396 15.245 5.58018 14.5939 4.72576C13.9429 3.87135 13.1053 3.17921 12.1461 2.70288C11.4836 2.3739 10.7753 2.15395 10.0481 2.04936C9.50726 1.97156 9.06207 1.53583 9.06207 0.9894Z" />
            </mask>
            <path
              d="M9.06207 0.9894C9.06207 0.442969 9.5064 -0.00569609 10.0494 0.0550816C11.0784 0.170244 12.0822 0.464843 13.0152 0.928146C14.2448 1.53872 15.3184 2.42593 16.153 3.52115C16.9876 4.61636 17.5608 5.89022 17.8283 7.24419C18.0318 8.2747 18.0541 9.33058 17.8967 10.3642C17.8148 10.9022 17.2685 11.2142 16.7431 11.0724C16.2202 10.9313 15.9172 10.3937 15.9828 9.85611C16.073 9.11655 16.046 8.36512 15.9009 7.63023C15.6922 6.57396 15.245 5.58018 14.5939 4.72576C13.9429 3.87135 13.1053 3.17921 12.1461 2.70288C11.4836 2.3739 10.7753 2.15395 10.0481 2.04936C9.50726 1.97156 9.06207 1.53583 9.06207 0.9894Z"
              stroke="#5B6EDD"
              strokeWidth="4"
              strokeLinejoin="round"
              mask="url(#path-2-inside-1_11154_53986)"
            />
          </svg>
          Loading...
        </div>
      </div>
    </div>
  );
};

export default memo(SplashScreen);
