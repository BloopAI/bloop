import { observable } from "mobx";

class LoginStore{
  @observable isLogin = false;
  @observable token = ""

  setLoginStatus(status: boolean){
    this.isLogin = status;
    this.token = ""
  }

  getLoginStatus(){
    return this.isLogin
  }

  changeToken(token: string) {
    this.token = token
  }

  getToken(){
    return this.token
  }

}

const loginStore = new LoginStore();

export default loginStore;
