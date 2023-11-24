import Button from '../../../components/Button';

type Props = {
  title: string;
  description: string;
  confirmBtnTxt: string;
  cancelBtnTxt: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmationPopup = ({
  title,
  description,
  confirmBtnTxt,
  cancelBtnTxt,
  onConfirm,
  onCancel,
}: Props) => {
  return (
    <div className="w-99 p-6 flex flex-col gap-8">
      <div className="flex flex-col gap-3 text-center">
        <h4 className="h4 text-label-title">{title}</h4>
        <p className="body-s text-label-muted">{description}</p>
      </div>
      <div className="flex flex-col gap-4">
        <Button onClick={onConfirm}>{confirmBtnTxt}</Button>
        <Button variant="secondary" onClick={onCancel}>
          {cancelBtnTxt}
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationPopup;
