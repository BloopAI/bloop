import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 6.5H13.5C15.7091 6.5 17.5 8.29086 17.5 10.5V13.5C17.5 15.7091 15.7091 17.5 13.5 17.5H10.5C8.29086 17.5 6.5 15.7091 6.5 13.5V12"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="1.25"
      y="1.25"
      width="11.5"
      height="11.5"
      rx="4.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M13 7.5H14.5C16.7091 7.5 18.5 9.29086 18.5 11.5V14.5C18.5 16.7091 16.7091 18.5 14.5 18.5H11.5C9.29086 18.5 7.5 16.7091 7.5 14.5V13"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="2.25"
      y="2.25"
      width="11.5"
      height="11.5"
      rx="4.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
