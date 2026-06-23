export enum DeliveryMode {
  /** Document requires the recipient to sign via a public URL. Agent returns a sign URL. */
  ClientSign = 'client_sign',
  /** Document is finished by the agent and downloaded by the owner to send manually. */
  OwnerSend = 'owner_send',
}
