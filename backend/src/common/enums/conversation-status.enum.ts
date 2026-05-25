export enum ConversationStatus {
  /** Bot is handling the conversation. */
  Bot = 'bot',
  /** A human agent has taken over. The bot will not respond until status flips back. */
  Human = 'human',
  /** Conversation is archived. */
  Closed = 'closed',
}
