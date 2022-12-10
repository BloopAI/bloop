import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1 5H15M15 5L10.6452 1M15 5L10.6452 9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 3L10 17M10 17L14 12.6452M10 17L6 12.6452"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
