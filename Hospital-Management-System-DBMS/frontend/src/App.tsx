import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes, // 改为 Routes
  Route
} from "react-router-dom";
import { Box } from "grommet";

// 导入组件
import Home from './Home';
import Login from './login.tsx';
import CreateAccount from './CreateAccount.tsx';
import SchedulingAppt from './schedulingAppt.tsx';
import ViewMedHist from './ViewMedHist.tsx';
import DocHome from './DocHome.tsx';
import ViewOneHistory from './ViewOneHistory.tsx';
import Settings from './Settings.tsx';
import DocSettings from './DocSettings.tsx';
import PatientsViewAppt from './PatientsViewAppt.tsx';
import NoMedHistFound from './NoMedHistFound.tsx';
import DocViewAppt from './DocViewAppt.tsx';
import MakeDoc from './MakeDoc.tsx';
import Diagnose from './Diagnose.tsx';
import ShowDiagnoses from './ShowDiagnoses.tsx';
import DocStatistics from "./DocStatistics";
import { UserService } from "./api/services/user.ts";

export default function App() {
  let [component, setComponent] = useState(<Login />)

  useEffect(() => {
    UserService.verify()
        .then((role) => {
            console.log("role:", role);
            if (role === 0) {
                setComponent(<Home />);
            } else if (role === 1) {
                setComponent(<DocHome />);
            } else {
                setComponent(<Login />);
            }
        })
        .catch((err) => {
            console.error("Session fetch error:", err);
            setComponent(<Login />);
        });
  }, [])

  return (
    <Router>
      <Box fill>
        <Routes> {/* 必须使用 Routes */}
          {/* v6 语法：element={<Component />} */}
          <Route path="/NoMedHistFound" element={<NoMedHistFound />} />
          <Route path="/MakeDoc" element={<MakeDoc />} />
          <Route path="/DocStatistics" element={<DocStatistics />} />
          <Route path="/Settings" element={<Settings />} />
          <Route path="/MedHistView" element={<ViewMedHist />} />
          <Route path="/scheduleAppt" element={<SchedulingAppt />} />
          
          {/* v6 不再使用 render 属性，直接传 element。
              在 ShowDiagnoses, Diagnose, ViewOneHistory 组件内部，
              请使用 import { useParams } from 'react-router-dom' 来获取 id 或 email */}
          <Route path="/showDiagnoses/:id" element={<ShowDiagnoses />} />
          <Route path="/Diagnose/:id" element={<Diagnose />} />
          <Route path="/ViewOneHistory/:email" element={<ViewOneHistory />} />
          
          <Route path="/Home" element={<Home />} />
          <Route path="/createAcc" element={<CreateAccount />} />
          <Route path="/DocHome" element={<DocHome />} />
          <Route path="/PatientsViewAppt" element={<PatientsViewAppt />} />
          <Route path="/DocSettings" element={<DocSettings />} />
          <Route path="/ApptList" element={<DocViewAppt />} />
          <Route path="/login" element={<Login />} />
          
          {/* 根路由 */}
          <Route path="/" element={component} />
        </Routes>
      </Box>
    </Router>
  );
}