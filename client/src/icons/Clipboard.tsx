import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M11 2H12.5C13.8807 2 15 3.11929 15 4.5V14.5C15 15.8807 13.8807 17 12.5 17H3.5C2.11929 17 1 15.8807 1 14.5V4.5C1 3.11929 2.11929 2 3.5 2H5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5.5 10.0952L7.5 12L11 8.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.75 2C4.75 1.30964 5.30964 0.75 6 0.75H10C10.6904 0.75 11.25 1.30964 11.25 2V4.38197C11.25 4.56781 11.0544 4.68869 10.8882 4.60557L8.78262 3.55279C8.28995 3.30645 7.71005 3.30645 7.21738 3.55279L5.1118 4.60557C4.94558 4.68869 4.75 4.56781 4.75 4.38197V2Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M13 3H14.5C15.8807 3 17 4.11929 17 5.5V15.5C17 16.8807 15.8807 18 14.5 18H5.5C4.11929 18 3 16.8807 3 15.5V5.5C3 4.11929 4.11929 3 5.5 3H7"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M7.5 11.0952L9.5 13L13 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.75 3C6.75 2.30964 7.30964 1.75 8 1.75H12C12.6904 1.75 13.25 2.30964 13.25 3V5.38197C13.25 5.56781 13.0544 5.68869 12.8882 5.60557L10.7826 4.55279C10.29 4.30645 9.71005 4.30645 9.21738 4.55279L7.1118 5.60557C6.94558 5.68869 6.75 5.56781 6.75 5.38197V3Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
