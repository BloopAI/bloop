import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M0.75 12.8C0.75 10.5632 2.56325 8.75 4.8 8.75H9.2C11.4368 8.75 13.25 10.5632 13.25 12.8C13.25 14.1531 12.1531 15.25 10.8 15.25H3.2C1.8469 15.25 0.75 14.1531 0.75 12.8Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle cx="7" cy="3" r="2.25" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.75 14.8C3.75 12.5632 5.56325 10.75 7.8 10.75H12.2C14.4368 10.75 16.25 12.5632 16.25 14.8C16.25 16.1531 15.1531 17.25 13.8 17.25H6.2C4.8469 17.25 3.75 16.1531 3.75 14.8Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle cx="10" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
