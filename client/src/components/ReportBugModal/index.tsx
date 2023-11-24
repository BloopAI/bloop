import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation, Trans } from 'react-i18next';
import Modal from '../../components/Modal';
import { BugIcon, CloseSign } from '../../icons';
import TextInput from '../TextInput';
import Button from '../Button';
import { UIContext } from '../../context/uiContext';
import { EMAIL_REGEX } from '../../consts/validations';
import { saveBugReport, saveCrashReport } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import { getJsonFromStorage, USER_DATA_FORM } from '../../services/storage';
import { EnvContext } from '../../context/envContext';
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
  const [serverLog, setServerLog] = useState('');
  const [serverCrashedMessage, setServerCrashedMessage] = useState('');
  const { isBugReportModalOpen, setBugReportModalOpen, activeTab } = useContext(
    UIContext.BugReport,
  );
  const { listen, os, release, invokeTauriCommand } = useContext(DeviceContext);
  const { envConfig } = useContext(EnvContext);

  const userForm = useMemo(
    (): { email: string; firstName: string; lastName: string } | null =>
      getJsonFromStorage(USER_DATA_FORM),
    [],
  );

  useEffect(() => {
    if (isBugReportModalOpen) {
      invokeTauriCommand('get_last_log_file').then((log) => {
        setServerLog(log);
      });
    }
  }, [isBugReportModalOpen]);

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
    setForm((prev) => ({
      ...prev,
      name: (userForm?.firstName || '') + (userForm?.lastName || ''),
      email: userForm?.email || '',
    }));
  }, [userForm]);

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
          server_log: serverLog,
        });
      } else {
        const { emailError, ...values } = form;
        saveBugReport({
          ...values,
          unique_id: envConfig.tracking_id || '',
          app_version: release,
          metadata: JSON.stringify(os),
          server_log: serverLog,
        });
      }
      setSubmitted(true);
    },
    [form, envConfig.tracking_id, release, serverLog],
  );
  const resetState = useCallback(() => {
    if (serverCrashedMessage) {
      console.log('go to empty page');
    }
    setForm((prev) => ({ ...prev, text: '', emailError: '' }));
    setSubmitted(false);
    setBugReportModalOpen(false);
    setServerCrashedMessage('');
    handleSubmit?.();
  }, [serverCrashedMessage, activeTab]);

  return (
    <Modal
      isVisible={isBugReportModalOpen || !!forceShow}
      onClose={() => setBugReportModalOpen(false)}
      // containerClassName="max-w-md2 max-h-[80vh]"
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
                <BugIcon />
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
    </Modal>
  );
};

export default memo(ReportBugModal);
