import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9.99999 1.66666C10.9205 0.74619 12.4128 0.746192 13.3333 1.66667V1.66667C14.2538 2.58714 14.2538 4.07953 13.3333 5L4.99999 13.3333L1.66665 13.3333L1.66665 10L9.99999 1.66666Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="8.86366"
      y1="2.80304"
      x2="12.197"
      y2="6.13638"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M8.75 12.5H8V14H8.75V12.5ZM14.25 14C14.6642 14 15 13.6642 15 13.25C15 12.8358 14.6642 12.5 14.25 12.5V14ZM8.75 14H14.25V12.5H8.75V14Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 3.66666C12.9205 2.74619 14.4128 2.74619 15.3333 3.66667V3.66667C16.2538 4.58714 16.2538 6.07953 15.3333 7L6.99999 15.3333L3.66665 15.3333L3.66665 12L12 3.66666Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="10.8637"
      y1="4.80304"
      x2="14.197"
      y2="8.13638"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M10.75 14.5H10V16H10.75V14.5ZM16.25 16C16.6642 16 17 15.6642 17 15.25C17 14.8358 16.6642 14.5 16.25 14.5V16ZM10.75 16H16.25V14.5H10.75V16Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
