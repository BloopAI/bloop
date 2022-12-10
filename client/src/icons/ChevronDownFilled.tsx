import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.99998 4.25L6.08331 1.75L1.91665 1.75L3.99998 4.25Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9.99998 11.25L12.0833 8.75L7.91665 8.75L9.99998 11.25Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
