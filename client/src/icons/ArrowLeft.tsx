import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15 5L1 5M1 5L5.35484 9M1 5L5.35484 0.999999"
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
      d="M17 10L3 10M3 10L7.35484 14M3 10L7.35484 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
