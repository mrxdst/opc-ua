# opc-ua

A lightweight OPC-UA client for node.js and the browser.  
This library was built to fit my needs and doesn't fully conform to any client profile.

**Note:** Only insecure endpoints are supported at the moment.

## Features

* TCP and WebSocket transports.
* Works in the browser (with webpack, WebSocket tansport only).
* Auto-reconnect (with re-creation of subscriptions).

## Implementation notes

* null strings and null arrays are typed as undefined.
* Multidimensional arrays are implemented using [ndarray](https://www.npmjs.com/package/ndarray).

## A note on TypeScript

This library relies on TypeScript for compile-time typechecks. Using wrong types is undefined behaviour.

## Example

### Subscribe to a value

````typescript
import {
  UaClient,
  AttributeIds,
  CreateMonitoredItemsRequest,
  CreateSubscriptionRequest,
  MonitoredItemCreateRequest,
  MonitoringMode,
  MonitoringParameters,
  ReadValueId,
  NodeId,
  NodeIds
} from 'opc-ua';

main();

async function main(): Promise<void> {
  const client = new UaClient({
    endpointUrl: 'opc.tcp://localhost'
  });

  await client.connect();

  const subscription = await client.createSubscription(new CreateSubscriptionRequest({
    publishingEnabled: true,
    requestedPublishingInterval: 500,
    requestedLifetimeCount: 60,
    requestedMaxKeepAliveCount: 10
  }));

  const monitoredItems = await subscription.createMonitoredItems(new CreateMonitoredItemsRequest({
    itemsToCreate: [
      new MonitoredItemCreateRequest({
        monitoringMode: MonitoringMode.Reporting,
        requestedParameters: new MonitoringParameters({
          samplingInterval: -1
        }),
        itemToMonitor: new ReadValueId({
          nodeId: NodeId.parse(NodeIds.Server_ServerStatus_CurrentTime),
          attributeId: AttributeIds.Value
        })
      })
    ]
  }));

  const monitoredItem = monitoredItems[0];

  monitoredItem.on('value', dataValue => {
    console.log(`Current time: ${dataValue.value?.value?.toLocaleString()}`);
  });
}
````