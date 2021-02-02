import { FindServersOnNetworkRequest, FindServersOnNetworkResponse, FindServersRequest, FindServersResponse, GetEndpointsRequest, GetEndpointsResponse, RequestHeader } from '../DataTypes/Generated';
import { ClientSecureConversation } from '../SecureConversation/ClientSecureConversation';
import { Request } from '../types';

/** This Service returns the Servers known to a Server or Discovery Server. */
export async function findServers(endpointUrl: string, request?: FindServersRequest): Promise<FindServersResponse> {
  const _request = new FindServersRequest({
    ...request,
    endpointUrl,
    requestHeader: newRequestHeader(request)
  });

  const sc = new ClientSecureConversation({
    endpointUrl,
    requestedLifetime: _request.requestHeader.timeoutHint,
    openTimeout: _request.requestHeader.timeoutHint
  });

  try {
    await sc.open();

    return await sc.sendRequest(_request) as FindServersResponse;
  } finally {
    await sc.close();
  }
}

/** This Service returns the Servers known to a Discovery Server. Unlike FindServers, this Service is only implemented by Discovery Servers. */
export async function findServersOnNetwork(endpointUrl: string, request?: FindServersOnNetworkRequest): Promise<FindServersOnNetworkResponse> {
  const _request = new FindServersOnNetworkRequest({
    ...request,
    requestHeader: newRequestHeader(request)
  });

  const sc = new ClientSecureConversation({
    endpointUrl,
    requestedLifetime: _request.requestHeader.timeoutHint,
    openTimeout: _request.requestHeader.timeoutHint
  });

  try {
    await sc.open();

    return await sc.sendRequest(_request) as FindServersOnNetworkResponse;
  } finally {
    await sc.close();
  }
}

/** This Service returns the Endpoints supported by a Server and all of the configuration information required to establish a SecureChannel and a Session. */
export async function getEndpoints(endpointUrl: string, request?: GetEndpointsRequest): Promise<GetEndpointsResponse> {
  const _request = new GetEndpointsRequest({
    ...request,
    endpointUrl,
    requestHeader: newRequestHeader(request)
  });

  const sc = new ClientSecureConversation({
    endpointUrl,
    requestedLifetime: _request.requestHeader.timeoutHint,
    openTimeout: _request.requestHeader.timeoutHint
  });

  try {
    await sc.open();

    return await sc.sendRequest(_request) as GetEndpointsResponse;
  } finally {
    await sc.close();
  }
}

function newRequestHeader(request?: Request): RequestHeader {
  return new RequestHeader({
    ...request?.requestHeader,
    timestamp: new Date(),
    timeoutHint: request?.requestHeader?.timeoutHint || 30_000
  });
}