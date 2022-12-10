import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.25 4.00002L1.75 1.91669L1.75 6.08335L4.25 4.00002Z"
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
      d="M11.25 10L8.75 7.91669L8.75 12.0834L11.25 10Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
