import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7.75 4.5L9.25 3L7.75 1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.25 13.5L4.75 15L6.25 16.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11.5 5C12.5489 6.11402 13 7.1433 13 8.83667C13 12.2404 10.3818 15 7.15262 15C6.57811 15 6.0248 14.9091 5.5 14.7465"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2.5 13C1.48109 11.8851 1.00002 10.8676 1.00002 9.19378C1.00002 5.77326 3.61819 3 6.84741 3C7.42191 3 7.97522 3.09136 8.50002 3.25472"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10.75 5.5L12.25 4L10.75 2.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.25 14.5L7.75 16L9.25 17.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 6C15.5489 7.11402 16 8.1433 16 9.83667C16 13.2404 13.3818 16 10.1526 16C9.57811 16 9.0248 15.9091 8.5 15.7465"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.5 14C4.48109 12.8851 4.00002 11.8676 4.00002 10.1938C4.00002 6.77326 6.61819 4 9.84741 4C10.4219 4 10.9752 4.09136 11.5 4.25472"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
