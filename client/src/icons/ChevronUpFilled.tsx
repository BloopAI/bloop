import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.99998 1.75L6.08331 4.25L1.91665 4.25L3.99998 1.75Z"
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
      d="M9.99998 8.75L12.0833 11.25L7.91665 11.25L9.99998 8.75Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
