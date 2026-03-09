import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChatContainer } from "@/components/chat/ChatContainer";

export function ChatPage() {
  const { sessionId } = useParams();

  return (
    <AppLayout fullWidth>
      <ChatContainer sessionId={sessionId} />
    </AppLayout>
  );
}
