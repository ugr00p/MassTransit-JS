export class MessageType {
    private static defaultNamespace: string = 'Messages';
    name: string;
    ns: string;

    constructor(name: string, ns?: string) {
        this.name = name;
        this.ns = ns ?? MessageType.defaultNamespace;
    }

    static setDefaultNamespace(ns: string) {
        this.defaultNamespace = ns;
    }

    toString(): string {
        return `urn:message:${this.ns}:${this.name}`;
    }

    toMessageType(): Array<string> {
        return [this.toString()];
    }
}

export class FaultMessageType {
  messageType: MessageType;
  constructor(messageType: MessageType) {
    this.messageType = messageType;
  }

  toString(): string {
    return `urn:message:MassTransit:Fault[[${this.messageType.ns}:${this.messageType.name}]]`;
  }

  toMessageType(): Array<string> {
    return [this.toString()];
  }
}

export class MessageOptions {
  persistent?: boolean;
  expiration?: string;
  constructor(data?: any) {
    this.persistent = data && data.persistent || true;
    this.expiration = data && data.expiration;
  }
}
