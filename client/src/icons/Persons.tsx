import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M0.75 12.8C0.75 10.5632 2.56325 8.75 4.8 8.75H8.2C10.4368 8.75 12.25 10.5632 12.25 12.8C12.25 14.1531 11.1531 15.25 9.8 15.25H3.2C1.8469 15.25 0.75 14.1531 0.75 12.8Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M14.5 9V9C16.1569 9 17.5 10.3431 17.5 12V12C17.5 13.1046 16.6046 14 15.5 14H14.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="7" cy="3" r="2.25" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="14" cy="5" r="1.25" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1.75 14.8C1.75 12.5632 3.56325 10.75 5.8 10.75H9.2C11.4368 10.75 13.25 12.5632 13.25 14.8C13.25 16.1531 12.1531 17.25 10.8 17.25H4.2C2.8469 17.25 1.75 16.1531 1.75 14.8Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M15.5 11V11C17.1569 11 18.5 12.3431 18.5 14V14C18.5 15.1046 17.6046 16 16.5 16H15.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="8" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="15" cy="7" r="1.25" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
