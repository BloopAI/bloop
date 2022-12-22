import IconWrapper from './Wrapper';

const RawIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.6 11H13V4H15.6C16.3732 4 17 4.55309 17 5.23537V9.76463C17 10.4469 16.3732 11 15.6 11Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 11.5551L11.1453 15.3172C10.8425 15.9315 10.1302 16.1755 9.54458 15.8657L9.5263 15.856C8.71315 15.4258 8.19951 14.5464 8.19951 13.5845V11.619H5.8002C5.2548 11.619 4.73881 11.3574 4.39712 10.9076C4.05542 10.4578 3.92486 9.86838 4.0421 9.30479L4.83463 5.49528C5.0163 4.62202 5.74759 4 6.59265 4H13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
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
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.6 11H13V4H15.6C16.3732 4 17 4.55309 17 5.23537V9.76463C17 10.4469 16.3732 11 15.6 11Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 11.5551L11.1453 15.3172C10.8425 15.9315 10.1302 16.1755 9.54458 15.8657L9.5263 15.856C8.71315 15.4258 8.19951 14.5464 8.19951 13.5845V11.619H5.8002C5.2548 11.619 4.73881 11.3574 4.39712 10.9076C4.05542 10.4578 3.92486 9.86838 4.0421 9.30479L4.83463 5.49528C5.0163 4.62202 5.74759 4 6.59265 4H13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
