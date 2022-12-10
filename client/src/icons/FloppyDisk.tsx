import IconWrapper from './Wrapper';

const RawIcon = (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.47 1.5H3.17251C2.24751 1.5 1.49918 2.25333 1.50584 3.17917L1.59251 14.8458C1.59918 15.7617 2.34334 16.5 3.25918 16.5H14.8267C15.7475 16.5 16.4933 15.7542 16.4933 14.8333V5.52333C16.4933 5.08167 16.3175 4.6575 16.005 4.345L13.6483 1.98833C13.3358 1.67583 12.9125 1.5 12.47 1.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.3275 1.5V4.7575C12.3275 5.2175 11.9542 5.59083 11.4942 5.59083H6.49416C6.03416 5.59083 5.66083 5.2175 5.66083 4.7575V1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.83334 16.5V10.0717C4.83334 9.48 5.31334 9 5.90501 9H12.0958C12.6867 9 13.1667 9.48 13.1667 10.0717V16.5"
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
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.47 2.5H4.17251C3.24751 2.5 2.49918 3.25333 2.50584 4.17917L2.59251 15.8458C2.59918 16.7617 3.34334 17.5 4.25918 17.5H15.8267C16.7475 17.5 17.4933 16.7542 17.4933 15.8333V6.52333C17.4933 6.08167 17.3175 5.6575 17.005 5.345L14.6483 2.98833C14.3358 2.67583 13.9125 2.5 13.47 2.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.3275 2.5V5.7575C13.3275 6.2175 12.9542 6.59083 12.4942 6.59083H7.49416C7.03416 6.59083 6.66083 6.2175 6.66083 5.7575V2.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.83334 17.5V11.0717C5.83334 10.48 6.31334 10 6.90501 10H13.0958C13.6867 10 14.1667 10.48 14.1667 11.0717V17.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default IconWrapper(RawIcon, BoxedIcon);
