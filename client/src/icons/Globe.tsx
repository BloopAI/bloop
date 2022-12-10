import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10 17.25C14.0041 17.25 17.25 14.0041 17.25 10C17.25 5.99594 14.0041 2.75 10 2.75C5.99594 2.75 2.75 5.99594 2.75 10C2.75 14.0041 5.99594 17.25 10 17.25Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.25 10C13.25 14.5 11.2426 17.25 10 17.25C8.7574 17.25 6.75 14.5 6.75 10C6.75 5.5 8.7574 2.75 10 2.75C11.2426 2.75 13.25 5.5 13.25 10Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10H10H17"
      stroke="#currentColor"
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
      d="M10 17.25C14.0041 17.25 17.25 14.0041 17.25 10C17.25 5.99594 14.0041 2.75 10 2.75C5.99594 2.75 2.75 5.99594 2.75 10C2.75 14.0041 5.99594 17.25 10 17.25Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.25 10C13.25 14.5 11.2426 17.25 10 17.25C8.7574 17.25 6.75 14.5 6.75 10C6.75 5.5 8.7574 2.75 10 2.75C11.2426 2.75 13.25 5.5 13.25 10Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10H10H17"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
