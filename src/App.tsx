import { useState } from 'react';
import { useApp } from './context/AppContext';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import Layout360 from './components/Layout360';
import OrgPage from './components/OrgPage';
import StockEntryPage from './components/StockEntryPage';
import SearchModal from './components/modals/SearchModal';
import ContentDetailModal from './components/modals/ContentDetailModal';
import AddContentModal from './components/modals/AddContentModal';
import AddRelationshipModal from './components/modals/AddRelationshipModal';
import AdminPanel from './components/modals/AdminPanel';
import ChatModal from './components/modals/ChatModal';

export default function App() {
  const {
    currentUser,
    loading,
    modalSearch,
    modalContentDetail,
    modalAddContent,
    modalAddRelationship,
    adminPanel,
    modalChat,
  } = useApp();

  const [showOrg, setShowOrg] = useState(false);
  const [showStock, setShowStock] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-200 overflow-hidden">
      <Header onOrgClick={() => setShowOrg(true)} onStockClick={() => setShowStock(true)} />
      <Layout360 />

      {/* Full-screen overlays */}
      {showOrg && <OrgPage onClose={() => setShowOrg(false)} />}
      {showStock && <StockEntryPage onClose={() => setShowStock(false)} />}

      {/* Modals */}
      {modalSearch && <SearchModal />}
      {modalContentDetail && <ContentDetailModal />}
      {modalAddContent && <AddContentModal />}
      {modalAddRelationship && <AddRelationshipModal />}
      {adminPanel && <AdminPanel />}
      {modalChat && <ChatModal />}
    </div>
  );
}
