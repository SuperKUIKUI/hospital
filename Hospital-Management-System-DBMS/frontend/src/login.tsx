import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 1. 导入 useNavigate 代替 withRouter
import {
  Box,
  Button,
  Heading,
  Grommet,
  FormField,
  Form,
  CheckBox,
  TextInput,
  Text,
  type ThemeType,
} from 'grommet';
import { UserService } from "./api/services/user";

import './App.css';

// ... theme 配置保持不变 ...
const theme: ThemeType = {
    global: {
        colors: {
            brand: "#000000",
            background: "#ffffff",
            focus: "transparent",
            text: "#000000",
            control: "#000000",
        },
        font: {
            family: '"Lato", "Helvetica Neue", "Microsoft JhengHei", sans-serif',
            size: "15px",
        },
        input: {
            weight: 700,
            extend: `
        padding: 12px;
        background: #ffffff;
      `,
        },
    },
    button: {
        border: { radius: "0px", width: "2px" },
        primary: { color: "#ffffff", background: "#000000" },
        extend: `
      font-weight: bold;
      letter-spacing: 1px;
    `,
    },
    formField: {
        border: { side: "all", color: "black", size: "2px" },
        label: {
            margin: { bottom: "xsmall", left: "xsmall", top: "small" },
            weight: "bold",
            size: "small",
        },
        margin: { bottom: "medium" },
        round: "0px",
    },
    checkBox: {
        border: { color: "black", width: "2px" },
        check: { thickness: "4px" },
        size: "20px",
        gap: "small",
    },
};

const AppBar = (props:any) => (
  <Box
    tag='header'
    direction='row'
    align='center'
    justify='between'
    background='black'
    pad={{ horizontal: 'xlarge', vertical: 'medium' }}
    flex={false}
    style={{ zIndex: '10' }}
    {...props}
  />
);

// 2. 将类组件改为函数组件
const Login = () => {
  const [isDoctor, setIsDoctor] = useState(false); // 使用 useState 管理状态
  const navigate = useNavigate(); // 获取导航函数

  return (
    <Grommet theme={theme} full>
      <Box fill background="#f0f0f0" overflow="auto">
        <AppBar>
          {/* 使用 navigate 进行 SPA 跳转，避免页面刷新 */}
          <Box onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <Heading level='3' margin='none' color='white' style={{ fontWeight: '800', letterSpacing: '2px' }}>
              HOSPITAL SYSTEM / 醫院管理系統
            </Heading>
          </Box>
        </AppBar>

        <Box fill align="center" justify="center" pad="large">
          <Box
            width="large"
            background="white"
            pad={{ horizontal: "xlarge", vertical: "xlarge" }}
            border={{ color: 'black', size: '3px' }}
            flex={false}
            style={{ 
              boxShadow: '16px 16px 0px 0px rgba(0,0,0,1)',
              minHeight: 'min-content',
              maxWidth: '90vw'
            }}
          >
            <Box 
              margin={{ bottom: 'large' }} 
              border={{ side: 'bottom', size: '6px', color: 'black' }} 
              pad={{ bottom: 'medium' }}
              flex={false}
            >
              <Heading level='1' margin="none" style={{ fontWeight: '900', letterSpacing: '-1px' }}>LOGIN</Heading>
              <Text size="medium" weight="bold">身份驗證 / USER AUTHENTICATION</Text>
            </Box>

            <Form
              onSubmit={({ value }:{ value: { email: string, password: string } }) => {
                const redirect = isDoctor ? "/DocHome" : "/Home";
                
                UserService.login(value.email, value.password)
                    .then(() => {
                        console.log("Succesfully login!");
                        navigate(redirect);
                    })
                    .catch(() => {
                        window.alert("登錄信息有誤 / INVALID CREDENTIALS");
                    });
              }}
            >
              <Box flex={false} gap="small">
                  <FormField label="EMAIL / 電子郵件地址" name="email" required>
                    <TextInput 
                      name="email" 
                      type="email" 
                      placeholder="doctor@hospital.com" 
                      plain 
                    />
                  </FormField>

                  <FormField label="PASSWORD / 安全密碼" name="password" required>
                    <TextInput 
                      name="password" 
                      type="password" 
                      placeholder="••••••••" 
                      plain 
                    />
                  </FormField>
              </Box>

              <Box margin={{ vertical: 'medium' }} pad={{ left: 'xsmall' }} flex={false}>
                <CheckBox
                  checked={isDoctor}
                  label={<Text weight="bold" size="medium">IDENTIFY AS DOCTOR / 以醫生身份登錄</Text>}
                  onChange={(event) => setIsDoctor(event.target.checked)}
                />
              </Box>

              <Box direction="row-responsive" gap="medium" margin={{ top: 'large' }} flex={false}>
                <Button 
                  fill="horizontal"
                  type="submit" 
                  label="SIGN IN / 登錄系統" 
                  primary 
                  style={{ padding: '16px' }}
                />
                <Button 
                  label="REGISTER / 註冊" 
                  fill="horizontal"
                  onClick={() => navigate('/createAcc')} // 使用 navigate 跳转
                  style={{ padding: '16px' }}
                />
              </Box>
            </Form>
          </Box>
          
          <Box margin={{ top: 'xlarge' }} flex={false}>
              <Text size="xsmall" color="dark-2" weight="bold" style={{ letterSpacing: '1px' }}>
              OFFICIAL ACCESS ONLY — SECURITY LEVEL 4 © 2026 HOSPITAL MANAGEMENT SYSTEM
              </Text>
          </Box>
        </Box>
      </Box>
    </Grommet>
  );
};

export default Login; // 4. 直接导出组件，不再需要 withRouter