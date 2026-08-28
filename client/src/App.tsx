import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';

import Login from './pages/Login';
import Dashboard from './pages/student/Dashboard';
import Companies from './pages/student/Companies';
import CompanyDetail from './pages/student/CompanyDetail';
import RoundDetail from './pages/student/RoundDetail';
import Roadmap from './pages/student/Roadmap';
import Practice from './pages/student/Practice';
import MockTests from './pages/student/MockTests';
import TestRunner from './pages/student/TestRunner';
import TestResult from './pages/student/TestResult';
import Coding from './pages/student/Coding';
import CodingProblem from './pages/student/CodingProblem';
import Performance from './pages/student/Performance';
import Leaderboard from './pages/student/Leaderboard';
import Profile from './pages/student/Profile';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminRounds from './pages/admin/AdminRounds';
import AdminQuestions from './pages/admin/AdminQuestions';
import AdminMockTests from './pages/admin/AdminMockTests';
import AdminStudents from './pages/admin/AdminStudents';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';

function RequireAuth({ children, staffOnly }: { children: ReactNode; staffOnly?: boolean }) {
  const { user, loading, isStaff } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (staffOnly && !isStaff) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* The test runner is deliberately outside the shell: a live paper needs
            the full viewport and no navigation that could lose answers. */}
        <Route
          path="/attempt/:attemptId"
          element={
            <RequireAuth>
              <TestRunner />
            </RequireAuth>
          }
        />

        <Route
          element={
            <RequireAuth>
              <Layout mode="student" />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/companies/:slug" element={<CompanyDetail />} />
          <Route path="/companies/:slug/rounds/:roundSlug" element={<RoundDetail />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/mock-tests" element={<MockTests />} />
          <Route path="/results/:attemptId" element={<TestResult />} />
          <Route path="/coding" element={<Coding />} />
          <Route path="/coding/:problemId" element={<CodingProblem />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route
          element={
            <RequireAuth staffOnly>
              <Layout mode="admin" />
            </RequireAuth>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/companies" element={<AdminCompanies />} />
          <Route path="/admin/rounds" element={<AdminRounds />} />
          <Route path="/admin/questions" element={<AdminQuestions />} />
          <Route path="/admin/mock-tests" element={<AdminMockTests />} />
          <Route path="/admin/students" element={<AdminStudents />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
