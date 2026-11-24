import CommunicationsClient, { CommunicationsError } from "./communications-client";
import DomainError from "./domain-error";
import Logger from "./logger";

interface InternalUserResponse {
  id: number;
  firstName: string;
  lastName: string;
}

class UserServiceClient {
  public static async fetchAuthorName(userId: number): Promise<string> {
    try {
      const user = await CommunicationsClient.request<InternalUserResponse>("user-microservice", "users.get", {
        id: userId,
      });
      return `${user.firstName} ${user.lastName}`.trim();
    } catch (error) {
      if (!(error instanceof CommunicationsError)) throw error;
      if (error.code === "NO_ENCONTRADO") {
        throw new DomainError(401, "No fue posible verificar la identidad del autor en el user-microservice.");
      }

      Logger.warn("No fue posible consultar el autor", { code: error.code, error: error.message, userId });
      throw new DomainError(502, "El directorio de usuarios no esta disponible. Intenta de nuevo en unos segundos.");
    }
  }
}

export default UserServiceClient;
