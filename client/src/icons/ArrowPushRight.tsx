import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 17 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1 6H12M12 6L9 3M12 6L9 9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="15.75"
      y1="0.75"
      x2="15.75"
      y2="11.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 10H14M14 10L11 7M14 10L11 13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="17.75"
      y1="4.75"
      x2="17.75"
      y2="15.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
