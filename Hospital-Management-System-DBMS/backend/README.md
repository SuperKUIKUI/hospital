# Hospital Management System Backend (Hono)

这是一个基于 [Hono](https://hono.dev/) 框架和 MySQL 开发的医院管理系统后端 API。

## 技术栈
- **Runtime**: Node.js
- **Framework**: Hono
- **Database**: MySQL 8.0+
- **Language**: TypeScript

## 基础信息
- **基础 URL**: `http://localhost:3001`
- **跨域控制**: 已开启 CORS。
- **日志**: 已集成 Hono Logger。

---

## API 概览

### 1. 认证与会话管理 (Authentication & Session)
| 接口 | 方法 | 说明 | 参数 (Query) |
| :--- | :--- | :--- | :--- |
| `/checklogin` | `GET` | 患者登录 | `email, password` |
| `/checkDoclogin` | `GET` | 医生登录 | `email, password` |
| `/userInSession` | `GET` | 获取当前登录用户信息 | 无 |
| `/endSession` | `GET` | 退出登录/清除会话 | 无 |

### 2. 患者相关接口 (Patient Management)
| 接口 | 方法 | 说明 | 参数 |
| :--- | :--- | :--- | :--- |
| `/checkIfPatientExists` | `GET` | 检查邮箱是否已注册 | `email` |
| `/makeAccount` | `GET` | 注册患者账户并初始化病史 | `name, email, password, address, gender, age, height, weight, medications, conditions, surgeries` |
| `/resetPasswordPatient` | `POST` | 修改患者密码 | `email, oldPassword, newPassword` |
| `/resetEmailPatient` | `POST` | 修改患者邮箱 | `oldEmail, newEmail, password` |
| `/OneHistory` | `GET` | 获取特定患者的完整病史 | `patientEmail` |
| `/checkIfHistory` | `GET` | 检查患者是否有病史记录 | `email` |

### 3. 医生相关接口 (Doctor Management)
| 接口 | 方法 | 说明 | 参数 |
| :--- | :--- | :--- | :--- |
| `/checkIfDocExists` | `GET` | 检查医生邮箱是否已注册 | `email` |
| `/makeDocAccount` | `GET` | 注册医生账户并关联排班 | `name, lastname, email, password, gender, schedule` |
| `/docInfo` | `GET` | 获取所有医生列表 | 无 |
| `/doctorStatistics` | `GET` | 获取当前医生的统计数据 (月度预约/性别比例) | 无 (依赖 Session) |
| `/resetPasswordDoctor` | `POST` | 修改医生密码 | `email, oldPassword, newPassword` |
| `/resetEmailDoctor` | `POST` | 修改医生邮箱 | `oldEmail, newEmail, password` |
| `/updateDoctorEmail` | `POST` | 管理员更新医生邮箱 | `oldEmail, newEmail` |

### 4. 预约管理 (Appointment Management)
| 接口 | 方法 | 说明 | 参数 |
| :--- | :--- | :--- | :--- |
| `/genApptUID` | `GET` | 生成下一个可用的预约 ID | 无 |
| `/getDocScheduleOnDate` | `GET` | 获取医生在特定日期的排班及繁忙状态 | `email, date` |
| `/checkIfApptExists` | `GET` | 检查预约时间冲突 | `email, docEmail, startTime, date` |
| `/schedule` | `GET` | 创建新的预约记录 | `id, date, time, endTime, doc` |
| `/addToPatientSeeAppt` | `GET` | 关联患者与预约 (症状记录) | `email, id, concerns, symptoms` |
| `/patientViewAppt` | `GET` | 患者查看自己的预约记录 | `email` |
| `/doctorViewAppt` | `GET` | 医生查看分配给自己的预约记录 | 无 (依赖 Session) |
| `/getDateTimeOfAppt` | `GET` | 获取特定预约的时间信息 | `id` |
| `/deleteAppt` | `GET` | 删除未完成的预约记录 | `uid` |

### 5. 诊断与病历 (Diagnosis & Medical Records)
| 接口 | 方法 | 说明 | 参数 |
| :--- | :--- | :--- | :--- |
| `/MedHistView` | `GET` | 医生查看其患者的病史概览 | `name` (可选) |
| `/diagnose` | `GET` | 提交诊断信息并更新预约状态为 Done | `id, diagnosis, prescription` |
| `/showDiagnoses` | `GET` | 获取特定预约的诊断详情 | `id` |
| `/allDiagnoses` | `GET` | 获取患者的所有历史诊断记录 | `patientEmail` |
| `/allDrugs` | `GET` | 获取系统中所有药物列表 | 无 |

---

## 数据库连接配置

在 `index.ts` 中修改 `dbConfig` 以匹配你的本地 MySQL 环境：

```typescript
const dbConfig = {
    host: "localhost",
    user: "hms_login",
    password: "你的密码",
    database: "HMS",
    multipleStatements: true,
};
```

## 开发建议 (Code Quality Review)

1.  **RESTful 规范**: 目前代码中大量使用 `app.get` 来执行写操作（如 `/makeAccount`, `/schedule`, `/diagnose`）。建议未来将其改为 `POST` 或 `PATCH`，并使用 `c.req.json()` 处理请求体。
2.  **安全性**:
    *   **密码加密**: 数据库中存储的是明文密码，建议使用 `bcrypt` 进行加密。
    *   **身份验证**: 目前依赖全局变量 `email_in_use` 维护状态，这在多用户并发时会导致会话混乱。建议引入 `hono/session` 或 JWT (JSON Web Tokens)。
    *   **SQL 注入**: 虽然使用了参数化查询，但部分动态拼接 SQL 的地方（如 `MedHistView`）仍需谨慎。
3.  **错误处理**: 建议将数据库逻辑封装到 Service 层，并统一捕获异常以返回一致的 JSON 错误格式。
4.  **连接池管理**: 确保在生产环境中配置合适的连接池大小和超时时间。

## 运行项目

```bash
npm install
npm run dev
```