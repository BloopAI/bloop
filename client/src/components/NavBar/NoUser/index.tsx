import Button from '../../Button';
import { ChevronRight } from '../../../icons';

const NavBarNoUser = () => {
  return (
    <span className="flex gap-2 justify-self-end">
      <Button size={'medium'} variant={'tertiary'}>
        Sign in
      </Button>
      <Button size={'medium'} variant={'secondary'}>
        Sign Up <ChevronRight />
      </Button>
    </span>
  );
};
export default NavBarNoUser;
