declare module 'web-push' {
  interface Subscription { endpoint: string; keys: { p256dh: string; auth: string } }
  interface Options { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string }
  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(sub: Subscription, payload?: string, options?: Options): Promise<{ statusCode: number }>;
    generateVAPIDKeys(): { publicKey: string; privateKey: string };
  };
  export default webpush;
}
