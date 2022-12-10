import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="1"
      y="1"
      width="16"
      height="16"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      y1="-0.75"
      x2="16"
      y2="-0.75"
      transform="matrix(-4.37114e-08 1 1 4.37114e-08 11 1)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="0.75"
      y1="-0.75"
      x2="2.25"
      y2="-0.75"
      transform="matrix(-1 0 0 1 15 5)"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="0.75"
      y1="-0.75"
      x2="2.25"
      y2="-0.75"
      transform="matrix(-1 0 0 1 15 8)"
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
      y="2"
      width="16"
      height="16"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      y1="-0.75"
      x2="16"
      y2="-0.75"
      transform="matrix(-4.37114e-08 1 1 4.37114e-08 12 2)"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="0.75"
      y1="-0.75"
      x2="2.25"
      y2="-0.75"
      transform="matrix(-1 0 0 1 16 6)"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="0.75"
      y1="-0.75"
      x2="2.25"
      y2="-0.75"
      transform="matrix(-1 0 0 1 16 9)"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
