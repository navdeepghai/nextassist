import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { Session } from "@/types";

export function useSessions() {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{
    message: Session[];
  }>("nextassist.api.session.list_sessions", { limit: 100 });

  const { call: createSession } = useFrappePostCall(
    "nextassist.api.session.create_session"
  );

  const { call: renameSession } = useFrappePostCall(
    "nextassist.api.session.rename_session"
  );

  const { call: deleteSession } = useFrappePostCall(
    "nextassist.api.session.delete_session"
  );

  const { call: continueSessionApi } = useFrappePostCall(
    "nextassist.api.session.continue_session"
  );

  const { call: updateSessionModelApi } = useFrappePostCall(
    "nextassist.api.session.update_session_model"
  );

  const handleCreateSession = async (title?: string) => {
    const result = await createSession({ title });
    await mutate();
    return result.message;
  };

  const handleRenameSession = async (sessionId: string, title: string) => {
    await renameSession({ session_id: sessionId, title });
    await mutate();
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession({ session_id: sessionId });
    await mutate();
  };

  const handleContinueSession = async (sessionId: string) => {
    const result = await continueSessionApi({ session_id: sessionId });
    await mutate();
    return result.message;
  };

  const handleUpdateSessionModel = async (
    sessionId: string,
    model: string
  ) => {
    const result = await updateSessionModelApi({
      session_id: sessionId,
      model,
    });
    await mutate();
    return result.message;
  };

  return {
    sessions: data?.message || [],
    isLoading,
    error,
    createSession: handleCreateSession,
    renameSession: handleRenameSession,
    deleteSession: handleDeleteSession,
    continueSession: handleContinueSession,
    updateSessionModel: handleUpdateSessionModel,
    refreshSessions: mutate,
  };
}
