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
      d="M5.4 9H8V16H5.4C4.6268 16 4 15.4469 4 14.7646V10.2354C4 9.55309 4.6268 9 5.4 9Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 8.44488L9.8547 4.68279C10.1575 4.06853 10.8698 3.82448 11.4554 4.13432L11.4737 4.14399C12.2868 4.57419 12.8005 5.45359 12.8005 6.41555V8.38097H15.1998C15.7452 8.38097 16.2612 8.64259 16.6029 9.09238C16.9446 9.54216 17.0751 10.1316 16.9579 10.6952L16.1654 14.5047C15.9837 15.378 15.2524 16 14.4073 16H8"
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
      d="M5.4 9H8V16H5.4C4.6268 16 4 15.4469 4 14.7646V10.2354C4 9.55309 4.6268 9 5.4 9Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 8.44488L9.8547 4.68279C10.1575 4.06853 10.8698 3.82448 11.4554 4.13432L11.4737 4.14399C12.2868 4.57419 12.8005 5.45359 12.8005 6.41555V8.38097H15.1998C15.7452 8.38097 16.2612 8.64259 16.6029 9.09238C16.9446 9.54216 17.0751 10.1316 16.9579 10.6952L16.1654 14.5047C15.9837 15.378 15.2524 16 14.4073 16H8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
