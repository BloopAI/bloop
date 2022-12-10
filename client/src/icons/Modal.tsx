import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="4"
      y="4"
      width="10"
      height="10"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M13 1H14C15.6569 1 17 2.34315 17 4V5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M13 17H14C15.6569 17 17 15.6569 17 14V13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M5 1H4C2.34315 1 1 2.34315 1 4V5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M5 17H4C2.34315 17 1 15.6569 1 14V13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="5"
      y="5"
      width="10"
      height="10"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M14 2H15C16.6569 2 18 3.34315 18 5V6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M14 18H15C16.6569 18 18 16.6569 18 15V14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M6 2H5C3.34315 2 2 3.34315 2 5V6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M6 18H5C3.34315 18 2 16.6569 2 15V14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
