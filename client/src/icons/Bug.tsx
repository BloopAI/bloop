import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="3.75"
      y="5"
      width="8.5"
      height="11.5"
      rx="4.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="5.25"
      y="1.5"
      width="5.5"
      height="2.5"
      rx="1.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M8 5.25V16.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M3.5 7.25L2.25722 6.75289C1.4979 6.44916 1 5.71374 1 4.89593V3.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M3.5 12.25L2.25722 12.7471C1.4979 13.0508 1 13.7863 1 14.6041V16.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M12.5 7.25L13.7428 6.75289C14.5021 6.44916 15 5.71374 15 4.89593V3.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M12.5 12.25L13.7428 12.7471C14.5021 13.0508 15 13.7863 15 14.6041V16.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="5.75"
      y="6"
      width="8.5"
      height="11.5"
      rx="4.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="7.25"
      y="2.5"
      width="5.5"
      height="2.5"
      rx="1.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M10 6.25V17.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M5.5 8.25L4.25722 7.75289C3.4979 7.44916 3 6.71374 3 5.89593V4.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M5.5 13.25L4.25722 13.7471C3.4979 14.0508 3 14.7863 3 15.6041V17.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M14.5 8.25L15.7428 7.75289C16.5021 7.44916 17 6.71374 17 5.89593V4.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M14.5 13.25L15.7428 13.7471C16.5021 14.0508 17 14.7863 17 15.6041V17.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
