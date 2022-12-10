import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="4.5" cy="16.5" r="1.5" fill="currentColor" />
    <rect x="11" y="3" width="2" height="10" fill="currentColor" />
    <rect
      x="7"
      y="9"
      width="2"
      height="10"
      transform="rotate(-90 7 9)"
      fill="currentColor"
    />
    <rect
      x="7.87524"
      y="5.05374"
      width="1.66667"
      height="10"
      transform="rotate(-45 7.87524 5.05374)"
      fill="currentColor"
    />
    <rect
      x="9.05371"
      y="12.1248"
      width="1.66667"
      height="10"
      transform="rotate(-135 9.05371 12.1248)"
      fill="currentColor"
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
    <circle cx="4.5" cy="16.5" r="1.5" fill="currentColor" />
    <rect x="11" y="3" width="2" height="10" fill="currentColor" />
    <rect
      x="7"
      y="9"
      width="2"
      height="10"
      transform="rotate(-90 7 9)"
      fill="currentColor"
    />
    <rect
      x="7.87524"
      y="5.05374"
      width="1.66667"
      height="10"
      transform="rotate(-45 7.87524 5.05374)"
      fill="currentColor"
    />
    <rect
      x="9.05371"
      y="12.1248"
      width="1.66667"
      height="10"
      transform="rotate(-135 9.05371 12.1248)"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
