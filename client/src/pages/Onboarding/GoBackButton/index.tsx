import Button from '../../../components/Button';
import { ArrowLeft } from '../../../icons';

type Props = {
  handleBack: (e: any) => void;
};

const GoBackButton = ({ handleBack }: Props) => {
  return (
    <div className="absolute top-2 left-2">
      <Button onlyIcon variant="tertiary" onClick={handleBack} title="Go back">
        <ArrowLeft />
      </Button>
    </div>
  );
};

export default GoBackButton;
