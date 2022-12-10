import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7 2H6C4.89543 2 4 2.89543 4 4V14C4 15.1046 4.89543 16 6 16H7"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M4 3H3C1.89543 3 1 3.89543 1 5V13C1 14.1046 1.89543 15 3 15H4"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="7"
      y="1"
      width="10"
      height="16"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8 3H7C5.89543 3 5 3.89543 5 5V15C5 16.1046 5.89543 17 7 17H8"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5 4H4C2.89543 4 2 4.89543 2 6V14C2 15.1046 2.89543 16 4 16H5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="8"
      y="2"
      width="10"
      height="16"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
