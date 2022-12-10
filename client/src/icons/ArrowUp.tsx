import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5 15L5 1M5 1L1 5.35484M5 1L9 5.35484"
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
      d="M10 17L10 3M10 3L6 7.35484M10 3L14 7.35484"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
