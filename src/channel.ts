export interface Event {
  type: string;
  payload?: any;
  error?: boolean;
  meta?: Object;
}

export class Channel {
  public trigger(type: string, payload?: any): Event {
    return { type, payload };
  }
}

export const channel = new Channel();

export const { trigger } = {
  trigger: channel.trigger.bind(channel),
};
