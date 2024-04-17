import React, { useEffect } from 'react';
import './GithubLogin.css';
import  {useLocation} from 'react-router-dom';
import useStateRef from '../hooks/useStateRef';
import { githubLogin } from '../services/api'; // 引入CSS样式文件
import {observer} from 'mobx-react';
import loginStore from './loginStore';

const GithubLogin = () => {
  const redirectToGitHubOAuth = () => {
    const clientId = "e5f8d6f79aa8b809b292";
    const redirectUri = "https://91e3-1-170-194-235.ngrok-free.app/api/auth/callback";
    const authUrl = "https://github.com/login/oauth/authorize";
    const oauthUrl = `${authUrl}?client_id=${clientId}&redirect_uri=${redirectUri}`;
    window.location.href = oauthUrl;
  }

  const location = useLocation();
  const stateRef = useStateRef('')

  useEffect(() => {
    // window.postMessage("login", {loginIn: true})
    console.log(location)
    console.log('SelfServe useEffect, githubLogin')
    console.log('getLoginStatus')
    console.log('getLoginStatus', loginStore.getLoginStatus())
    // 使用URLSearchParams来解析查询参数
    const params = new URLSearchParams(location.search);
    const accessToken = params.get('access_token');
     if(accessToken){
       alert("链接中存在token，现在更新loginSore")
       console.log("链接中存在token字段 ", accessToken)
       loginStore.setLoginStatus(true)
       loginStore.changeToken(accessToken)
     }else{
       console.log("链接中不存在token字段")
     }


  }, []);

  return (
    <div className="login-container">
      <h1 className="login-title">欢迎使用 Bloop </h1>
      <p className="login-text">点击下面的按钮以跳转到 GitHub 的认证页面：</p>
      <button className="login-button" onClick={() => redirectToGitHubOAuth()}>GitHub 登录</button>
    </div>
  );
}

export default GithubLogin;