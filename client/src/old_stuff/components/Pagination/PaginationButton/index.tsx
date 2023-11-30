type Props = {
  page: number;
  onClick: () => void;
  active: boolean;
};

const PaginationButton = ({ page, onClick, active }: Props) => {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-4 caption-strong ${
        active
          ? 'bg-bg-main text-label-control'
          : 'bg-transparent text-label-base hover:border-bg-border'
      } border border-transparent transition-all duration-200 ease-in-bounce`}
    >
      {page}
    </button>
  );
};

export default PaginationButton;
