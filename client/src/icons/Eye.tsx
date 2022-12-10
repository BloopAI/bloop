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
      d="M10 4C14.8895 4 16.9456 8.74947 17.3996 9.99145C17.4697 10.1829 17.4672 10.3868 17.3906 10.5757C16.9187 11.7384 14.8577 16 10 16C5.14234 16 3.08135 11.7384 2.60944 10.5757C2.53276 10.3868 2.53034 10.1829 2.60035 9.99145C3.05442 8.74947 5.11046 4 10 4Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
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
      d="M10 4C14.8895 4 16.9456 8.74947 17.3996 9.99145C17.4697 10.1829 17.4672 10.3868 17.3906 10.5757C16.9187 11.7384 14.8577 16 10 16C5.14234 16 3.08135 11.7384 2.60944 10.5757C2.53276 10.3868 2.53034 10.1829 2.60035 9.99145C3.05442 8.74947 5.11046 4 10 4Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
