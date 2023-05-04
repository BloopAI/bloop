type Props = {
  text: string;
  active?: boolean;
};

const Badge = ({ text, active }: Props) => {
  return (
    <span
      className={`${active ? 'bg-bg-main' : 'bg-bg-shade'} px-2 py-1 rounded`}
    >
      {text}
    </span>
  );
};
export default Badge;
