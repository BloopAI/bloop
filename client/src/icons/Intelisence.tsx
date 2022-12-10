import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="12"
    height="14"
    viewBox="0 0 12 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 3.99999L0.4855 3.1425L5.4855 0.142502H6.5145L11.5145 3.1425L12 3.99999V10L11.5145 10.8575L6.5145 13.8575H5.4855L0.4855 10.8575L0 10V3.99999ZM5.5 12.7L1 10V4.84225L5.5 7.2968V12.7ZM6.5 12.7L11 10V4.84225L6.5 7.2968V12.7ZM6 0.999992L1.25913 3.84451L6 6.43044L10.7409 3.84451L6 0.999992Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 4.99999L2.4855 4.1425L7.4855 1.1425H8.5145L13.5145 4.1425L14 4.99999V11L13.5145 11.8575L8.5145 14.8575H7.4855L2.4855 11.8575L2 11V4.99999ZM7.5 13.7L3 11V5.84225L7.5 8.2968V13.7ZM8.5 13.7L13 11V5.84225L8.5 8.2968V13.7ZM8 1.99999L3.25913 4.84451L8 7.43044L12.7409 4.84451L8 1.99999Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
