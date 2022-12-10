import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12.839 3.98444C13.6834 3.01364 12.9939 1.5 11.7072 1.5H2.29279C1.00613 1.5 0.316608 3.01364 1.16103 3.98444L4.90902 8.29332C5.22563 8.65731 5.4 9.12347 5.4 9.6059V13.3187C5.4 13.7015 5.61853 14.0507 5.96281 14.218L7.16281 14.8014C7.827 15.1242 8.6 14.6405 8.6 13.902V9.6059C8.6 9.12347 8.77437 8.65731 9.09099 8.29332L12.839 3.98444Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxedIcon = (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15.839 5.98444C16.6834 5.01364 15.9939 3.5 14.7072 3.5H5.29279C4.00613 3.5 3.31661 5.01364 4.16103 5.98444L7.90902 10.2933C8.22563 10.6573 8.4 11.1235 8.4 11.6059V15.3187C8.4 15.7015 8.61853 16.0507 8.96281 16.218L10.1628 16.8014C10.827 17.1242 11.6 16.6405 11.6 15.902V11.6059C11.6 11.1235 11.7744 10.6573 12.091 10.2933L15.839 5.98444Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
