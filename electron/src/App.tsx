import React, { useState, useEffect } from 'react';
import type { NavTab, UpdateData } from './types';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import UpdaterToast from './components/UpdaterToast';
import HomeView from './views/HomeView';
import BoardView from './views/BoardView';
import StudioView from './views/StudioView';
import DocsView from './views/DocsView';
import ChatView from './views/ChatView';
import SettingsView from './views/SettingsView';
import AppBridge from './services/bridge';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [updateData, setUpdateData] = useState<UpdateData>({ status: 'idle' });

  useEffect(() => {
    // 1. Listen for background auto-updater events via Electron contextBridge
    const unsubscribe = AppBridge.os.onUpdateStatus((data) => {
      setUpdateData(data);
    });

    // 2. Fetch updater info on boot
    AppBridge.os.getUpdaterInfo().then((info) => {
      setUpdateData((prev) => ({
        ...prev,
        version: info.version,
        isPortable: info.isPortable,
      }));
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // View Transitions Navigation
  const navigateWithTransition = (tab: NavTab) => {
    if (tab === activeTab) return;

    if ('startViewTransition' in document && typeof (document as any).startViewTransition === 'function') {
      (document as any).startViewTransition(() => {
        setActiveTab(tab);
      });
    } else {
      setActiveTab(tab);
    }
  };

  const handleNavigate = (tab: NavTab, projectId?: number | null) => {
    if (projectId !== undefined) {
      setSelectedProjectId(projectId);
    }
    navigateWithTransition(tab);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#111110] text-[#edeae4] overflow-hidden select-none">
      {/* Native Drag Titlebar */}
      <Titlebar activeTab={activeTab} />

      {/* Main Workstation Container */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={navigateWithTransition}
          updateData={updateData}
        />

        <main className="flex-1 h-full overflow-hidden bg-[#111110] relative">
          {activeTab === 'home' && <HomeView onNavigate={handleNavigate} />}
          {activeTab === 'board' && (
            <BoardView
              selectedProjectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
            />
          )}
          {activeTab === 'dashboard' && <StudioView />}
          {activeTab === 'documents' && <DocsView initialProjectId={selectedProjectId} />}
          {activeTab === 'chat' && <ChatView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* In-App Auto-Updater Toast */}
      <UpdaterToast data={updateData} />
    </div>
  );
};

export default App;
