import { createBrowserRouter } from 'react-router';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Transactions from './pages/Transactions';
import History from './pages/History';
import Reports from './pages/Reports';
import Users from './pages/Users';
import NotFound from './pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'cameras', Component: Cameras },
      { path: 'transactions', Component: Transactions },
      { path: 'history', Component: History },
      { path: 'reports', Component: Reports },
      { path: 'users', Component: Users },
    ],
  },
  {
    path: '*',
    Component: NotFound,
  },
]);
