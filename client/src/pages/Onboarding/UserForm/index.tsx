import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
} from 'react';
import { BloopLogo, ChevronRight, GitHubLogo } from '../../../icons';
import TextInput from '../../../components/TextInput';
import { EMAIL_REGEX } from '../../../consts/validations';
import Button from '../../../components/Button';
import { UIContext } from '../../../context/uiContext';
import { DeviceContext } from '../../../context/deviceContext';
import { gitHubLogout } from '../../../services/api';
import { Form } from '../index';

type Props = {
  form: Form;
  setForm: Dispatch<SetStateAction<Form>>;
  setGitHubScreen: (b: boolean) => void;
  onContinue: () => void;
};

const UserForm = ({ form, setForm, setGitHubScreen, onContinue }: Props) => {
  const { isGithubConnected, setGithubConnected } = useContext(UIContext);
  const { envConfig, openLink } = useContext(DeviceContext);

  const handleLogout = useCallback(() => {
    gitHubLogout();
    setGithubConnected(false);
  }, []);

  return (
    <>
      <div className="flex flex-col gap-3 text-center relative">
        <div className="w-11 h-11 absolute left-1/2 -top-16 transform -translate-x-1/2">
          <BloopLogo />
        </div>
        <h4 className="text-label-title">Setup bloop</h4>
        <p className="text-label-muted body-s">
          Please log into your GitHub account to complete setup
        </p>
      </div>
      <form className="flex flex-col gap-4 w-full">
        <TextInput
          value={form.firstName}
          name="firstName"
          placeholder="First name"
          variant="filled"
          onChange={(e) =>
            setForm((prev) => ({ ...prev, firstName: e.target.value }))
          }
          autoFocus
        />
        <TextInput
          value={form.lastName}
          name="lastName"
          placeholder="Last name"
          variant="filled"
          onChange={(e) =>
            setForm((prev) => ({ ...prev, lastName: e.target.value }))
          }
        />
        <TextInput
          value={form.email}
          variant="filled"
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              email: e.target.value,
              emailError: null,
            }))
          }
          validate={() => {
            if (form.email && !EMAIL_REGEX.test(form.email)) {
              setForm((prev) => ({
                ...prev,
                emailError: 'Email is not valid',
              }));
            }
          }}
          error={form.emailError}
          name="email"
          placeholder="Email address"
        />
        <div className="flex items-center pl-2.5 gap-2.5 border border-bg-border rounded-4">
          <GitHubLogo />
          <p className="callout text-label-title flex-1">
            {isGithubConnected ? envConfig.github_user?.login : 'GitHub'}
          </p>
          <button
            type="button"
            className={`caption text-label-title ${
              isGithubConnected ? 'px-3' : 'pl-3 pr-2'
            } h-10 flex gap-1 items-center border-l border-bg-border hover:bg-bg-base-hover`}
            onClick={() =>
              isGithubConnected ? handleLogout() : setGitHubScreen(true)
            }
          >
            {isGithubConnected ? 'Disconnect' : 'Connect account'}{' '}
            {!isGithubConnected && <ChevronRight />}
          </button>
        </div>
        <Button
          disabled={
            !isGithubConnected ||
            !form.firstName ||
            !form.lastName ||
            !form.email
          }
          onClick={onContinue}
        >
          Continue
        </Button>
      </form>
      {isGithubConnected && (
        <p className="caption text-label-base text-center">
          By continuing you accept our
          <br />
          <button
            onClick={() => openLink('https://bloop.ai/terms')}
            className="text-label-link"
          >
            Terms & conditions
          </button>{' '}
          and{' '}
          <button
            onClick={() => openLink('https://bloop.ai/privacy')}
            className="text-label-link"
          >
            Privacy policy
          </button>
        </p>
      )}
    </>
  );
};

export default UserForm;
