import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.8599 14.4551L14.1324 16.9692C14.2474 17.1967 14.1566 17.4742 13.9291 17.5892L12.5582 18.2834C12.3307 18.3984 12.0532 18.3076 11.9382 18.0801L10.6657 15.5659L8.47241 16.9384L8.47741 9.32591C8.47741 8.94591 8.91158 8.72925 9.21575 8.95758L15.2641 13.5009L12.8599 14.4551Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.5 9.15008C16.4817 5.01425 13.1325 1.66675 9.00083 1.66675C4.85833 1.66675 1.5 5.03175 1.5 9.18341C1.5 11.2509 2.33333 13.1217 3.68083 14.4809"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 9.15591C13.9875 6.39841 11.755 4.16675 9.00083 4.16675C6.23917 4.16675 4 6.41008 4 9.17758C4 10.5559 4.55583 11.8034 5.45417 12.7092"
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
      d="M13.8599 14.4551L15.1324 16.9692C15.2474 17.1967 15.1566 17.4742 14.9291 17.5892L13.5582 18.2834C13.3307 18.3984 13.0532 18.3076 12.9382 18.0801L11.6657 15.5659L9.47241 16.9384L9.47741 9.32591C9.47741 8.94591 9.91158 8.72925 10.2157 8.95758L16.2641 13.5009L13.8599 14.4551Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17.5 9.15008C17.4817 5.01425 14.1325 1.66675 10.0008 1.66675C5.85833 1.66675 2.5 5.03175 2.5 9.18341C2.5 11.2509 3.33333 13.1217 4.68083 14.4809"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 9.15591C14.9875 6.39841 12.755 4.16675 10.0008 4.16675C7.23917 4.16675 5 6.41008 5 9.17758C5 10.5559 5.55583 11.8034 6.45417 12.7092"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
