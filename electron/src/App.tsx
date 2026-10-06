import React, { useState, useEffect } from 'react';
import type { NavTab, UpdateData } from './types';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import UpdaterToast from './components/UpdaterToast';
import CommandPalette from './components/CommandPalette';
import HomeView from './views/HomeView';
import BoardView from './views/BoardView';
import StudioView from './views/StudioView';
import DocsView from './views/DocsView';
import ChatView from './views/ChatView';
import SettingsView from './views/SettingsView';
import ErrorBoundary from './components/ErrorBoundary';
import AppBridge from './services/bridge';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [previousTab, setPreviousTab] = useState<NavTab | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [updateData, setUpdateData] = useState<UpdateData>({ status: 'idle' });
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    // 1. Listen for background auto-updater events via Electron contextBridge
    const unsubscribe = AppBridge.os.onUpdateStatus((data) => {
      setUpdateData(data);
    });

    // 2. Fetch updater info on boot and trigger automated background update check
    AppBridge.os.getUpdaterInfo().then((info) => {
      setUpdateData((prev) => ({
        ...prev,
        version: info.version,
        isPortable: info.isPortable,
      }));
      // Automatically check for updates silently on startup
      AppBridge.os.checkForUpdates();
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // View Transitions Navigation
  const navigateWithTransition = (tab: NavTab) => {
    if (tab === activeTab) return;
    setPreviousTab(activeTab);

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

  // Universal Global Keyboard Shortcuts Engine
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Allow Esc to close palette if open
      if (e.key === 'Escape' && isPaletteOpen) {
        setIsPaletteOpen(false);
        return;
      }

      // Check for modifier keys (Ctrl or Cmd)
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'k') {
          e.preventDefault();
          e.stopPropagation();
          setIsPaletteOpen((prev) => !prev);
        } else if (key === 'b') {
          e.preventDefault();
          setIsSidebarCollapsed((prev) => !prev);
        } else if (key === '1') {
          e.preventDefault();
          navigateWithTransition('home');
        } else if (key === '2') {
          e.preventDefault();
          navigateWithTransition('board');
        } else if (key === '3') {
          e.preventDefault();
          navigateWithTransition('dashboard');
        } else if (key === '4') {
          e.preventDefault();
          navigateWithTransition('documents');
        } else if (key === '5') {
          e.preventDefault();
          navigateWithTransition('chat');
        } else if (key === '6') {
          e.preventDefault();
          navigateWithTransition('settings');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [isPaletteOpen, activeTab]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#111110] text-[#edeae4] overflow-hidden select-none">
      {/* Native Drag Titlebar */}
      <Titlebar
        activeTab={activeTab}
        version={updateData.version || '2.0.1'}
        onOpenPalette={() => setIsPaletteOpen(true)}
      />

      {/* Main Workstation Container */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={navigateWithTransition}
          updateData={updateData}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        <main className="flex-1 h-full overflow-hidden bg-[#111110] relative">
          <ErrorBoundary fallbackTitle="Module Error">
            {activeTab === 'home' && <HomeView onNavigate={handleNavigate} />}
            {activeTab === 'board' && (
              <BoardView
                selectedProjectId={selectedProjectId}
                onProjectChange={setSelectedProjectId}
              />
            )}
            {activeTab === 'dashboard' && <StudioView />}
            {activeTab === 'documents' && <DocsView initialProjectId={selectedProjectId} />}
            {activeTab === 'chat' && (
              <ChatView
                inheritedTab={previousTab}
                initialProjectId={selectedProjectId}
                onClearInheritedTab={() => setPreviousTab(null)}
              />
            )}
            {activeTab === 'settings' && <SettingsView />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <ErrorBoundary fallbackTitle="Command Palette Error">
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          onNavigate={handleNavigate}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </ErrorBoundary>

      {/* In-App Background Auto-Updater Toast */}
      <UpdaterToast data={updateData} />
    </div>
  );
};

export default App;
