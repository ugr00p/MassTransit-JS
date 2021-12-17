import {MessageMap} from './serialization';
import {ReceiveEndpoint} from './receiveEndpoint';
import {Guid} from 'guid-typescript';
import {SendEndpoint} from './sendEndpoint';
import {ConsumeContext} from './consumeContext';
import {FaultMessageType, MessageOptions, MessageType} from './messageType';
export interface RequestClient<TRequest extends MessageMap, TResponse extends MessageMap> {
    getResponse(request: TRequest): Promise<ConsumeContext<TResponse>>
}

export class RequestClient<TRequest extends MessageMap, TResponse extends MessageMap> implements RequestClient<TRequest, TResponse> {
    private readonly responses: RequestMap<TResponse>;
    private sendEndpoint: SendEndpoint;
    private readonly requestType: MessageType;
    private responseType: MessageType;
    private faultResponseType: FaultMessageType;
    private options?: MessageOptions;
    private requestTimeOut?: number;
    private readonly responseAddress: string;

    constructor(receiveEndpoint: ReceiveEndpoint, sendEndpoint: SendEndpoint, requestType: MessageType, responseType: MessageType, requestTimeOut?: number, options?: MessageOptions) {
        this.sendEndpoint = sendEndpoint;
        this.requestType = requestType;
        this.responseType = responseType;
        this.faultResponseType = new FaultMessageType(requestType);

        this.responseAddress = receiveEndpoint.address.toString();
        this.responses = {};
        this.options = options;
        this.requestTimeOut = requestTimeOut;
        receiveEndpoint.handle<TResponse>(responseType, response => this.onResponse(response));
        receiveEndpoint.handleError<TResponse>(this.faultResponseType, response => this.onErrorResponse(response));
    }

    getResponse(request: TRequest): Promise<ConsumeContext<TResponse>> {
        return new Promise<ConsumeContext<TResponse>>(async (resolve, reject) => {
            let requestId = Guid.create().toString();

            this.responses[requestId] = new ResponseFuture<TResponse>(requestId, resolve, reject, this.requestTimeOut);
            await this.sendEndpoint.send<TRequest>(request, this.options, x => {
                x.requestId = requestId;
                x.responseAddress = this.responseAddress;
                x.messageType = this.requestType.toMessageType();
            });
        });
    }

    private async onResponse(context: ConsumeContext<TResponse>): Promise<void> {
        if (context.requestId) {
            let pendingRequest = this.responses[context.requestId];
            if (pendingRequest) {
              if (pendingRequest.timeout) {
                clearTimeout(pendingRequest.timeout);
              }
              pendingRequest.resolve(context);
              delete this.responses[context.requestId];
            }
        }
    }

  private async onErrorResponse(context: ConsumeContext<TResponse>): Promise<void> {
    if (context.requestId) {
      let pendingRequest = this.responses[context.requestId];
      if (pendingRequest) {
        if (pendingRequest.timeout) {
          clearTimeout(pendingRequest.timeout);
        }
        pendingRequest.reject(context.message);
        delete this.responses[context.requestId];
      }
    }
  }
}

class ResponseFuture<TResponse extends MessageMap> {
    requestId: string;
    resolve: (value: ConsumeContext<TResponse> | PromiseLike<ConsumeContext<TResponse>>) => void;
    reject: (reason?: any) => void;
    timeout?: NodeJS.Timeout;

    constructor(requestId: string, resolve: (value: ConsumeContext<TResponse> | PromiseLike<ConsumeContext<TResponse>>) => void, reject: (reason?: any) => void, timeout?: number) {
        this.resolve = resolve;
        this.reject = reject;
        this.requestId = requestId;
        if (timeout) {
          this.timeout = setTimeout(()=>{
            reject(`request timeout in ${timeout}`)
          }, timeout)
        }
    }

}

type RequestMap<TResponse extends MessageMap> = Record<string, ResponseFuture<TResponse>>
