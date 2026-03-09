import { useFrappeGetCall } from "frappe-react-sdk";
import { ProviderModels } from "@/types";

export function useAvailableModels() {
  const { data, error, isLoading } = useFrappeGetCall<{
    message: ProviderModels[];
  }>("nextassist.api.session.get_available_models");

  return {
    providerModels: data?.message || [],
    isLoading,
    error,
  };
}
