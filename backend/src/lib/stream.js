import { StreamChat } from "stream-chat";
import "dotenv/config";

const apiKey = process.env.STEAM_API_KEY;
const apiSecret = process.env.STEAM_API_SECRET;

const streamClient = StreamChat.getInstance(apiKey, apiSecret);

export const generateStreamToken = (userId) => {
  return streamClient.createToken(userId.toString());
};
