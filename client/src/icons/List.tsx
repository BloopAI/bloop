import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line
      x1="4.75"
      y1="1.25"
      x2="13.25"
      y2="1.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="0.75"
      y1="1.25"
      x2="1.25"
      y2="1.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="0.75"
      y1="5.25"
      x2="13.25"
      y2="5.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="0.75"
      y1="9.25"
      x2="13.25"
      y2="9.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
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
    <line
      x1="7.75"
      y1="5.25"
      x2="16.25"
      y2="5.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="3.75"
      y1="5.25"
      x2="4.25"
      y2="5.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="3.75"
      y1="9.25"
      x2="16.25"
      y2="9.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="3.75"
      y1="13.25"
      x2="16.25"
      y2="13.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
