import React, {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTranslation, Trans } from 'react-i18next';
import ModalOrSidebar from '../ModalOrSidebar';
import { Bug, CloseSign } from '../../icons';
import TextInput from '../TextInput';
import Button from '../Button';
import { UIContext } from '../../context/uiContext';
import { EMAIL_REGEX } from '../../consts/validations';
import { saveBugReport, saveCrashReport } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import { TabsContext } from '../../context/tabsContext';
import ConfirmImg from './ConfirmImg';

type Props = {
  errorBoundaryMessage?: string;
  handleSubmit?: () => void;
  forceShow?: boolean;
};
const ReportBugModal = ({
  errorBoundaryMessage,
  handleSubmit,
  forceShow,
}: Props) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    email: '',
    text: '',
    emailError: '',
  });
  const [isSubmitted, setSubmitted] = useState(false);
  const [serverCrashedMessage, setServerCrashedMessage] = useState('');
  const { onBoardingState, isBugReportModalOpen, setBugReportModalOpen } =
    useContext(UIContext);
  const { envConfig, listen, os, release } = useContext(DeviceContext);
  const { handleRemoveTab, setActiveTab, activeTab } = useContext(TabsContext);

  useEffect(() => {
    listen('server-crashed', (event) => {
      console.log(event);
      setBugReportModalOpen(true);
      setServerCrashedMessage(event.payload.message);
    });
  }, [listen]);

  useEffect(() => {
    if (errorBoundaryMessage) {
      setServerCrashedMessage(errorBoundaryMessage);
    }
  }, [errorBoundaryMessage]);

  useEffect(() => {
    const savedForm = onBoardingState['STEP_DATA_FORM'];

    setForm((prev) => ({
      ...prev,
      name: (savedForm?.firstName || '') + (savedForm?.lastName || ''),
      email: savedForm?.email || '',
    }));
  }, [onBoardingState]);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({
        ...prev,
        [e.target.name]: e.target.value,
        emailError: e.target.name === 'email' ? '' : prev.emailError,
      }));
    },
    [],
  );

  const onSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      if (serverCrashedMessage) {
        saveCrashReport({
          text: form.text,
          unique_id: envConfig.tracking_id || '',
          info: serverCrashedMessage,
          metadata: JSON.stringify(os),
          app_version: release,
        });
      } else {
        const { emailError, ...values } = form;
        saveBugReport({
          ...values,
          unique_id: envConfig.tracking_id || '',
          app_version: release,
        });
      }
      setSubmitted(true);
    },
    [form, envConfig.tracking_id, release],
  );
  const resetState = useCallback(() => {
    if (serverCrashedMessage) {
      handleRemoveTab(activeTab);
      setActiveTab('initial');
    }
    setForm((prev) => ({ ...prev, text: '', emailError: '' }));
    setSubmitted(false);
    setBugReportModalOpen(false);
    setServerCrashedMessage('');
    handleSubmit?.();
  }, [handleRemoveTab, setActiveTab, serverCrashedMessage, activeTab]);

  return (
    <ModalOrSidebar
      isSidebar={false}
      shouldShow={isBugReportModalOpen || !!forceShow}
      onClose={() => setBugReportModalOpen(false)}
      isModalSidebarTransition={false}
      setIsModalSidebarTransition={() => {}}
      shouldStretch={false}
      fullOverlay
      containerClassName="max-w-md2 max-h-[80vh]"
    >
      <div className="p-6 flex flex-col gap-8 relative bg-bg-shade overflow-auto">
        {!isSubmitted ? (
          serverCrashedMessage ? (
            <>
              <div className="flex flex-col gap-3 items-center">
                <h4 className="text-label-title">
                  <Trans>bloop crashed unexpectedly</Trans>
                </h4>
                <p className="body-s text-label-base text-center">
                  <Trans>
                    By submitting this crash report you agree to send it to
                    bloop for investigation.
                  </Trans>
                </p>
              </div>
              <form className="flex flex-col gap-4 overflow-auto">
                <TextInput
                  value={form.text}
                  onChange={onChange}
                  name="text"
                  multiline
                  variant="filled"
                  placeholder={t`Provide any steps necessary to reproduce the problem...`}
                />
                <div className="flex flex-col overflow-auto">
                  <p className="body-s text-label-title mb-1">
                    <Trans>Problem details and System configuration</Trans>
                  </p>
                  <p className="body-s text-label-base border border-bg-border p-2.5 rounded-4 overflow-auto">
                    {serverCrashedMessage}
                    <br />
                    <br />
                    Type: {os.type}
                    <br />
                    Platform: {os.platform}
                    <br />
                    Arch: {os.arch}
                    <br />
                    Version: {os.version}
                    <br />
                  </p>
                </div>
              </form>
              <Button type="submit" onClick={onSubmit}>
                <Trans>Submit crash report</Trans>
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 items-center text-label-title">
                <Bug />
                <h4>
                  <Trans>Report a bug</Trans>
                </h4>
                <p className="body-s text-label-base text-center">
                  <Trans>
                    We want to make this the best experience for you. If you
                    encountered a bug, please submit this bug report to us. Our
                    team will investigate as soon as possible.
                  </Trans>
                </p>
              </div>
              <form className="flex flex-col gap-4">
                <TextInput
                  value={form.name}
                  onChange={onChange}
                  name="name"
                  variant="filled"
                  placeholder={t`Full name`}
                />
                <TextInput
                  value={form.email}
                  onChange={onChange}
                  validate={() => {
                    if (!EMAIL_REGEX.test(form.email)) {
                      setForm((prev) => ({
                        ...prev,
                        emailError: t`Email is not valid`,
                      }));
                    }
                  }}
                  error={form.emailError}
                  name="email"
                  variant="filled"
                  placeholder={t`Email address`}
                />
                <TextInput
                  value={form.text}
                  onChange={onChange}
                  name="text"
                  multiline
                  variant="filled"
                  placeholder={t`Describe the bug to help us reproduce it...`}
                />
              </form>
              <Button type="submit" onClick={onSubmit} disabled={!form.text}>
                <Trans>Submit bug report</Trans>
              </Button>
            </>
          )
        ) : (
          <>
            <div className="flex flex-col gap-3 items-center">
              <h4>
                <Trans>Thank you!</Trans>
              </h4>
              <p className="body-s text-label-base text-center">
                <Trans>
                  We’ll investigate and reach out back soon if necessary.
                </Trans>
              </p>
            </div>
            <div className="w-full">
              <ConfirmImg />
            </div>
            <Button variant="secondary" onClick={resetState}>
              <Trans>Got it!</Trans>
            </Button>
          </>
        )}
        <div className="absolute top-2 right-2">
          <Button
            onlyIcon
            title={t`Close`}
            variant="tertiary"
            size="small"
            onClick={resetState}
          >
            <CloseSign />
          </Button>
        </div>
      </div>
    </ModalOrSidebar>
  );
};

export default ReportBugModal;
