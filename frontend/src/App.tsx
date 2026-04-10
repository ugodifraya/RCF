import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Questionnaires from './pages/Questionnaires';
import QuestionnaireDetail from './pages/QuestionnaireDetail';
import HealthTracking from './pages/HealthTracking';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import Statistics from './pages/Statistics';
import Players from './pages/Players';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? <>{children}</> : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="events" element={<Events />} />
        <Route path="questionnaires" element={<Questionnaires />} />
        <Route path="questionnaires/:id" element={<QuestionnaireDetail />} />
        <Route path="health" element={<HealthTracking />} />
        <Route path="matches" element={<Matches />} />
        <Route path="matches/:id" element={<MatchDetail />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="players" element={<Players />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
