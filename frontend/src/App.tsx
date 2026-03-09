import { FrappeProvider } from "frappe-react-sdk";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import { ChatPage } from "@/pages/ChatPage";
import { ProviderList } from "@/pages/providers/ProviderList";
import { ProviderForm } from "@/pages/providers/ProviderForm";
import { SessionList } from "@/pages/sessions/SessionList";
import { SessionForm } from "@/pages/sessions/SessionForm";
import { SettingsForm } from "@/pages/settings/SettingsForm";
import { SchedulerList } from "@/pages/schedulers/SchedulerList";
import { SchedulerForm } from "@/pages/schedulers/SchedulerForm";

function getBaseUrl(): string {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_FRAPPE_URL || "";
  }
  return "";
}

function getSiteName(): string {
  // @ts-ignore
  return window.frappe?.boot?.sitename || import.meta.env.VITE_SITE_NAME || "";
}

function App() {
  return (
    <FrappeProvider
      url={getBaseUrl()}
      siteName={getSiteName()}
      socketPort={
        // @ts-ignore
        window.frappe?.boot?.socketio_port || import.meta.env.VITE_SOCKET_PORT
      }
    >
      <BrowserRouter basename="/nextassist">
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
          <Route path="/providers" element={<ProviderList />} />
          <Route path="/providers/new" element={<ProviderForm />} />
          <Route path="/providers/:provider_name" element={<ProviderForm />} />
          <Route path="/sessions" element={<SessionList />} />
          <Route path="/sessions/:sessionId" element={<SessionForm />} />
          <Route path="/schedulers" element={<SchedulerList />} />
          <Route path="/schedulers/new" element={<SchedulerForm />} />
          <Route path="/schedulers/:schedulerId" element={<SchedulerForm />} />
          <Route path="/settings" element={<SettingsForm />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors theme="system" />
    </FrappeProvider>
  );
}

export default App;
