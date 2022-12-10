import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1 4V12C1 13.381 4.134 14.5 8 14.5C11.866 14.5 15 13.381 15 12V4C15 2.619 11.866 1.5 8 1.5C4.134 1.5 1 2.619 1 4Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 4C15 5.381 11.866 6.5 8 6.5C4.134 6.5 1 5.381 1 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 8C15 9.381 11.866 10.5 8 10.5C4.134 10.5 1 9.381 1 8"
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
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 6V14C3 15.381 6.134 16.5 10 16.5C13.866 16.5 17 15.381 17 14V6C17 4.619 13.866 3.5 10 3.5C6.134 3.5 3 4.619 3 6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 6C17 7.381 13.866 8.5 10 8.5C6.134 8.5 3 7.381 3 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 10C17 11.381 13.866 12.5 10 12.5C6.134 12.5 3 11.381 3 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
