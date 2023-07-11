import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1.97099 5.83063C1.50476 6.12202 0.899994 5.78683 0.899994 5.23703L0.899994 0.762973C0.899994 0.213168 1.50476 -0.122022 1.97099 0.169374L5.55024 2.4064C5.9889 2.68057 5.9889 3.31943 5.55024 3.5936L1.97099 5.83063Z"
      fill="currentColor"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8.53 14.0438C7.86395 14.46 7 13.9812 7 13.1958L7 6.80425C7 6.01881 7.86395 5.53997 8.53 5.95625L13.6432 9.152C14.2699 9.54367 14.2699 10.4563 13.6432 10.848L8.53 14.0438Z"
      fill="currentColor"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
