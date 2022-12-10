import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 6 8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1.75 4.00002L4.25 1.91669L4.25 6.08335L1.75 4.00002Z"
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
      d="M8.75 10L11.25 7.91669L11.25 12.0834L8.75 10Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
