const StepsLine = () => {
  return (
    <svg
      width="12"
      height="274"
      viewBox="0 0 12 274"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="6" cy="26" r="5" stroke="#16A24A" strokeWidth="2" />
      <circle cx="6" cy="169" r="5" stroke="#16A24A" strokeWidth="2" />
      <rect
        x="5"
        width="2"
        height="16"
        rx="1"
        fill="url(#paint0_linear_8639_246829)"
      />
      <rect
        x="5"
        y="179"
        width="2"
        height="95"
        rx="1"
        fill="url(#paint1_linear_8639_246829)"
      />
      <rect x="5" y="36" width="2" height="123" rx="1" fill="#2E2E39" />
      <defs>
        <linearGradient
          id="paint0_linear_8639_246829"
          x1="6"
          y1="0"
          x2="6"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#101011" />
          <stop offset="1" stopColor="#2E2E39" />
        </linearGradient>
        <linearGradient
          id="paint1_linear_8639_246829"
          x1="6"
          y1="179"
          x2="6"
          y2="274"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2E2E39" />
          <stop offset="1" stopColor="#101011" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default StepsLine;
