import config from "../config";
import DomainError from "./domain-error";

interface InternalUserResponse {
  id: number;
  firstName: string;
  lastName: string;
}

class UserServiceClient {
  public static async fetchAuthorName(userId: number): Promise<string> {
    const response = await fetch(`${config.userServiceUrl}/api/v1/internal/users/${userId}`, {
      headers: { "X-Internal-Token": config.internalServiceToken },
    });

    if (!response.ok) {
      throw new DomainError(401, "No fue posible verificar la identidad del autor en el user-microservice.");
    }

    const user = (await response.json()) as InternalUserResponse;
    return `${user.firstName} ${user.lastName}`.trim();
  }
}

export default UserServiceClient;
