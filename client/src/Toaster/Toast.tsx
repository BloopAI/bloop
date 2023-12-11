import { memo, useCallback, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ToastType } from '../types/general';
import { ChatBubblesIcon, CloseSignIcon } from '../icons';
import Button from '../components/Button';
import { ToastsContext } from '../context/toastsContext';

type Props = ToastType & {};

const Toast = ({ type, text, title, id, Icon }: Props) => {
  const { t } = useTranslation();
  const { closeToast } = useContext(ToastsContext.Handlers);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      closeToast(id);
    }, 5000);
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const handleClose = useCallback(() => {
    closeToast(id);
  }, [id, closeToast]);

  return (
    <div className="w-[20.75rem] p-4 flex flex-col items-start gap-2 rounded-md border border-bg-border bg-bg-base shadow-high">
      <div className="w-full flex gap-3 items-center">
        {Icon ? (
          <Icon
            sizeClassName="w-4 h-4"
            className={type === 'default' ? 'text-label-muted' : 'text-red'}
          />
        ) : (
          <ChatBubblesIcon
            sizeClassName="w-4 h-4"
            className={type === 'default' ? 'text-label-muted' : 'text-red'}
          />
        )}
        <p
          className={`body-s-b flex-1 ${
            type === 'default' ? 'text-label-title' : 'text-red'
          }`}
        >
          {title}
        </p>
        <Button
          variant="ghost"
          size="mini"
          onlyIcon
          title={t('Close')}
          onClick={handleClose}
        >
          <CloseSignIcon sizeClassName="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="pl-7">
        <p className="text-label-muted body-s">{text}</p>
      </div>
    </div>
  );
};

export default memo(Toast);
