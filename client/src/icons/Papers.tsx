import React from 'react';
import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3.5 4.5V15.5C3.5 16.8807 4.61929 18 6 18H12.5C14.7091 18 16.5 16.2091 16.5 14V4.5C16.5 3.11929 15.3807 2 14 2H6C4.61929 2 3.5 3.11929 3.5 4.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="6.75"
      y1="6.25"
      x2="13.25"
      y2="6.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="6.75"
      y1="9.25"
      x2="10.25"
      y2="9.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M11.5 15.5C11.5 14.1193 12.6193 13 14 13H16.5V14C16.5 16.2091 14.7091 18 12.5 18H11.5V15.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3.5 4.5V15.5C3.5 16.8807 4.61929 18 6 18H12.5C14.7091 18 16.5 16.2091 16.5 14V4.5C16.5 3.11929 15.3807 2 14 2H6C4.61929 2 3.5 3.11929 3.5 4.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="6.75"
      y1="6.25"
      x2="13.25"
      y2="6.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="6.75"
      y1="9.25"
      x2="10.25"
      y2="9.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M11.5 15.5C11.5 14.1193 12.6193 13 14 13H16.5V14C16.5 16.2091 14.7091 18 12.5 18H11.5V15.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
