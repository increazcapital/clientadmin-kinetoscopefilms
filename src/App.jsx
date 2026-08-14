/* ============================================================
   Root: App.jsx
   Description: Client portal root component with routing
   ============================================================ */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';

// Layout
import MainLayout from './components/layout/MainLayout';

// Auth Pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';

// Main Pages
import DashboardHome from './pages/dashboard/DashboardHome';
import InvestmentOverview from './pages/investment/InvestmentOverview';
import CompleteTransactionDetails from './pages/investment/CompleteTransactionDetails';
import Portfolio from './pages/portfolio/Portfolio';
import ProjectSelection from './pages/projects/ProjectSelection';
import PerksAndRecognition from './pages/perks/PerksAndRecognition';
import PaymentRequests from './pages/payments/PaymentRequests';
import ServiceRequests from './pages/service-requests/ServiceRequests';
import NewServiceRequest from './pages/service-requests/NewServiceRequest';
import ServiceRequestDetail from './pages/service-requests/ServiceRequestDetail';
import Profile from './pages/profile/Profile';
import MediaFeed from './pages/media/MediaFeed';
import MediaDetail from './pages/media/MediaDetail';
import OnboardingDetails from './pages/onboarding/OnboardingDetails';
import FAQPage from './pages/faq/FAQPage';
import NotFound from './pages/NotFound';

// Protected Route Wrapper
function ProtectedRoute({ children }) {
  const auth = localStorage.getItem('kfpl_client_auth');
  if (!auth) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Routes (MainLayout wraps all) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="investment" element={<InvestmentOverview />} />
            <Route path="complete-transaction-details" element={<CompleteTransactionDetails />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="projects" element={<ProjectSelection />} />
            <Route path="perks" element={<PerksAndRecognition />} />
            <Route path="payments" element={<PaymentRequests />} />
            <Route path="service-requests" element={<ServiceRequests />} />
            <Route path="service-requests/new" element={<NewServiceRequest />} />
            <Route path="service-requests/:id" element={<ServiceRequestDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="media" element={<MediaFeed />} />
            <Route path="media/:id" element={<MediaDetail />} />
            <Route path="onboarding/details" element={<OnboardingDetails />} />
            <Route path="faq" element={<FAQPage />} />

            {/* 404 inside layout */}
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Redirects & Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

/* ============ END: App.jsx ============ */
