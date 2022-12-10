import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="1"
      y="1"
      width="16"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      y1="-0.75"
      x2="16"
      y2="-0.75"
      transform="matrix(1 0 0 -1 1 5)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="4.25"
      y1="3.25"
      x2="3.75"
      y2="3.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="7.25"
      y1="3.25"
      x2="6.75"
      y2="3.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="2"
      y="3"
      width="16"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      y1="-0.75"
      x2="16"
      y2="-0.75"
      transform="matrix(1 0 0 -1 2 7)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="5.25"
      y1="5.25"
      x2="4.75"
      y2="5.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="8.25"
      y1="5.25"
      x2="7.75"
      y2="5.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
